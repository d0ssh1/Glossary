"""SCORM 1.2 / 2004 ZIP package builder.

Builds the archive entirely in memory (`io.BytesIO` + `zipfile`) per info.md.
Contents:
    imsmanifest.xml   — SCORM manifest (1.2 or 2004)
    data.json         — full glossary tree consumed by the bundled player
    index.html        — minimal viewer (placeholder; production should bundle
                        the real `scorm_player.html` from the frontend build)
"""
from __future__ import annotations

import io
import json
import zipfile
from typing import Literal

from sqlalchemy.orm import Session

from app.models import Glossary

ScormVersion = Literal["1.2", "2004"]


def _build_data_json(db: Session, glossary: Glossary) -> dict:
    """Pack glossary + course tree + bindings into a static JSON blob."""
    course = glossary.course
    sections = []
    for sec in course.sections:
        lessons = []
        for lesson in sec.lessons:
            steps = [
                {
                    "id": st.id,
                    "position": st.position,
                    "step_url": st.step_url,
                }
                for st in lesson.steps
            ]
            lessons.append(
                {"id": lesson.id, "title": lesson.title, "position": lesson.position, "steps": steps}
            )
        sections.append(
            {"id": sec.id, "title": sec.title, "position": sec.position, "lessons": lessons}
        )

    terms = []
    for term in glossary.terms:
        terms.append(
            {
                "id": term.id,
                "name": term.name,
                "definition": term.definition,
                "bindings": [
                    {"step_id": b.step_id, "is_primary": b.is_primary} for b in term.bindings
                ],
            }
        )

    return {
        "course": {"id": course.id, "title": course.title, "sections": sections},
        "glossary": {"id": glossary.id, "title": glossary.title, "terms": terms},
    }


def _manifest_xml(course_title: str, scorm_id: str, version: ScormVersion) -> str:
    schema = (
        '<schema>ADL SCORM</schema><schemaversion>1.2</schemaversion>'
        if version == "1.2"
        else '<schema>ADL SCORM</schema><schemaversion>2004 4th Edition</schemaversion>'
    )
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="{scorm_id}" version="1.0"
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>{schema}</metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>{course_title}</title>
      <item identifier="ITEM-1" identifierref="RES-1">
        <title>{course_title}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="data.json"/>
    </resource>
  </resources>
</manifest>
"""


_PLACEHOLDER_PLAYER = r"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<title>Lexicon Weaver — Glossary Viewer</title>
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
<style>
  :root{--bg:#f6f5f2;--panel:#ffffff;--text:#1a1a1a;--muted:#6b6b66;--border:#e0dfda;--accent:#6b6b66}
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;font-family:Inter,system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text)}
  header{padding:10px 16px;border-bottom:1px solid var(--border);background:var(--panel);font-size:14px;font-weight:600}
  header small{color:var(--muted);font-weight:400;margin-left:8px}
  .layout{display:flex;height:calc(100vh - 41px)}
  .panel{background:var(--panel);overflow-y:auto}
  .left{width:260px;border-right:1px solid var(--border)}
  .right{width:320px;border-left:1px solid var(--border);padding:14px}
  .center{flex:1;position:relative;background:var(--bg)}
  #graph{position:absolute;inset:0}
  .term-row{padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;cursor:pointer}
  .term-row:hover{background:#f0efe9}
  .term-row.active{background:#e8e6df;font-weight:600}
  .term-row .def{color:var(--muted);font-size:11px;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  h2{font-size:14px;margin:0 0 8px 0}
  .right p.def{color:var(--text);font-size:13px;line-height:1.45;margin:0 0 14px 0}
  .right .links-title{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px 0}
  .right a.step-link{display:block;padding:6px 8px;border:1px solid var(--border);border-radius:4px;margin-bottom:4px;color:var(--text);text-decoration:none;font-size:12px}
  .right a.step-link:hover{background:#f0efe9}
  .empty{color:var(--muted);font-size:12px;font-style:italic;padding:14px}
</style>
</head>
<body>
<header><span id="course-title">Loading…</span><small id="glossary-title"></small></header>
<div class="layout">
  <aside class="panel left" id="term-list"></aside>
  <section class="center"><div id="graph"></div></section>
  <aside class="panel right" id="details">
    <p class="empty">Выберите термин слева или на графе.</p>
  </aside>
</div>
<script>
(function(){
  // ----- SCORM 1.2 wrapper (best-effort, fails silently for preview) -----
  function findAPI(win){
    var n = 0;
    while(win && !win.API && win.parent && win.parent !== win && n < 10){ win = win.parent; n++; }
    return win && win.API ? win.API : null;
  }
  var API = null;
  try { API = findAPI(window) || (window.opener ? findAPI(window.opener) : null); } catch(e){}
  try { if(API) API.LMSInitialize(""); } catch(e){}
  window.addEventListener('unload', function(){
    try { if(API){ API.LMSSetValue("cmi.core.lesson_status","completed"); API.LMSFinish(""); } } catch(e){}
  });

  // ----- Load data and render -----
  var state = { data: null, activeTermId: null };

  fetch('data.json').then(function(r){return r.json();}).then(function(data){
    state.data = data;
    document.getElementById('course-title').textContent = data.course.title || 'Курс';
    document.getElementById('glossary-title').textContent = data.glossary.title ? '— ' + data.glossary.title : '';
    renderTermList();
    renderGraph();
  }).catch(function(err){
    document.getElementById('course-title').textContent = 'Ошибка загрузки данных';
    console.error(err);
  });

  function renderTermList(){
    var root = document.getElementById('term-list');
    root.innerHTML = '';
    var terms = (state.data.glossary.terms || []).slice().sort(function(a,b){
      return (a.name||'').localeCompare(b.name||'', 'ru');
    });
    if(!terms.length){ root.innerHTML = '<p class="empty">Глоссарий пуст.</p>'; return; }
    terms.forEach(function(t){
      var row = document.createElement('div');
      row.className = 'term-row' + (t.id === state.activeTermId ? ' active' : '');
      row.dataset.termId = String(t.id);
      row.innerHTML = '<div>' + escapeHtml(t.name) + '</div>' +
        (t.definition ? '<div class="def">' + escapeHtml(t.definition) + '</div>' : '');
      row.addEventListener('click', function(){ selectTerm(t.id); });
      root.appendChild(row);
    });
  }

  function renderGraph(){
    var lessons = [];
    (state.data.course.sections || []).forEach(function(sec){
      (sec.lessons || []).forEach(function(l){ lessons.push(l); });
    });
    var stepToLesson = {};
    lessons.forEach(function(l){
      (l.steps || []).forEach(function(s){ stepToLesson[s.id] = l.id; });
    });

    var nodes = [];
    var edges = [];
    lessons.forEach(function(l){
      nodes.push({ id: 'lesson-' + l.id, label: l.title, shape: 'box',
        color: { background:'#1a1a1a', border:'#1a1a1a' },
        font: { color:'#ffffff', size: 13 } });
    });
    (state.data.glossary.terms || []).forEach(function(t){
      var hasPrimary = (t.bindings || []).some(function(b){ return b.is_primary; });
      // Term node: solid (primary present) or faded (mentions only)
      var bg = hasPrimary ? '#6b6b66' : 'rgba(107,107,102,0.45)';
      nodes.push({ id: 'term-' + t.id, label: t.name, shape: 'dot', size: 14,
        color: { background: bg, border:'#1a1a1a' },
        font: { color:'#1a1a1a', size: 12 } });
      (t.bindings || []).forEach(function(b){
        var lid = stepToLesson[b.step_id];
        if(lid == null) return;
        edges.push({
          from: 'term-' + t.id,
          to: 'lesson-' + lid,
          color: { color: b.is_primary ? '#1a1a1a' : '#bdbcb6' },
          width: b.is_primary ? 2 : 1
        });
      });
    });

    var container = document.getElementById('graph');
    var network = new vis.Network(container,
      { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) },
      {
        manipulation: { enabled: false },
        interaction: { dragNodes: true, dragView: true, zoomView: true, selectConnectedEdges: false },
        physics: { stabilization: { iterations: 150 } },
        nodes: { borderWidth: 1 },
        edges: { smooth: { type: 'continuous' } }
      }
    );
    network.on('click', function(p){
      if(p.nodes && p.nodes.length){
        var id = String(p.nodes[0]);
        if(id.indexOf('term-') === 0){ selectTerm(Number(id.slice(5))); }
      }
    });
    state.network = network;
  }

  function selectTerm(termId){
    state.activeTermId = termId;
    var term = (state.data.glossary.terms || []).find(function(t){ return t.id === termId; });
    if(!term){ return; }
    // Update list highlight
    document.querySelectorAll('.term-row').forEach(function(el){
      el.classList.toggle('active', Number(el.dataset.termId) === termId);
    });
    // Update details
    var stepById = {};
    (state.data.course.sections || []).forEach(function(sec){
      (sec.lessons || []).forEach(function(l){
        (l.steps || []).forEach(function(s){
          stepById[s.id] = { step: s, lesson: l, section: sec };
        });
      });
    });
    var detailsEl = document.getElementById('details');
    var html = '<h2>' + escapeHtml(term.name) + '</h2>';
    html += '<p class="def">' + (term.definition ? escapeHtml(term.definition) : '<em style="color:var(--muted)">Без определения</em>') + '</p>';
    html += '<p class="links-title">Упоминания (' + (term.bindings || []).length + ')</p>';
    if(!term.bindings || !term.bindings.length){
      html += '<p class="empty" style="padding:0">Нет связей.</p>';
    } else {
      term.bindings.forEach(function(b){
        var info = stepById[b.step_id];
        if(!info) return;
        var label = (info.section.title || '') + ' / ' + (info.lesson.title || '') + ' / Шаг ' + (info.step.position || '?');
        var marker = b.is_primary ? '<strong>[первое]</strong> ' : '';
        var url = info.step.step_url || '#';
        html += '<a class="step-link" href="' + escapeAttr(url) + '" target="_blank" rel="noopener">' + marker + escapeHtml(label) + '</a>';
      });
    }
    detailsEl.innerHTML = html;
    // Highlight on graph
    if(state.network){ try { state.network.selectNodes(['term-' + termId]); } catch(e){} }
  }

  function escapeHtml(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }
  function escapeAttr(s){ return escapeHtml(s); }
})();
</script>
</body></html>
"""


def build_scorm_zip(
    db: Session,
    glossary: Glossary,
    scorm_id: str,
    version: ScormVersion = "1.2",
) -> bytes:
    """Return the SCORM archive as bytes."""
    data = _build_data_json(db, glossary)
    manifest = _manifest_xml(glossary.course.title, scorm_id, version)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("imsmanifest.xml", manifest)
        zf.writestr("data.json", json.dumps(data, ensure_ascii=False, indent=2))
        zf.writestr("index.html", _PLACEHOLDER_PLAYER)
    return buf.getvalue()
