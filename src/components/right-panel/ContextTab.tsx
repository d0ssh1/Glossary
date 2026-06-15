import { useApp } from '@/store/AppContext';
import EmptyState from './EmptyState';
import NodeSelectedState from './NodeSelectedState';
import TermSelectedState from './TermSelectedState';
import LinkSelectedState from './LinkSelectedState';

export default function ContextTab() {
  const { state } = useApp();
  const { activeTermId, activeNodeId, activeLinkId, courses, activeGlossaryId } = state;

  const activeGlossary = courses.flatMap(c => c.glossaries).find(g => g.id === activeGlossaryId);
  const activeTerm = activeGlossary?.terms.find(t => t.id === activeTermId);

  // `key` forces a fresh editor per term so unsaved local edits never bleed
  // from one term into another when switching directly between them.
  if (activeTermId && activeTerm) return <TermSelectedState key={activeTerm.id} term={activeTerm} />;
  if (activeLinkId) return <LinkSelectedState />;
  if (activeNodeId) return <NodeSelectedState />;
  return <EmptyState />;
}
