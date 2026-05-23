import { useApp } from '@/store/AppContext';
import EmptyState from './EmptyState';
import NodeSelectedState from './NodeSelectedState';
import TermSelectedState from './TermSelectedState';

export default function ContextTab() {
  const { state } = useApp();
  const { activeTermId, activeNodeId, courses, activeGlossaryId } = state;

  const activeGlossary = courses.flatMap(c => c.glossaries).find(g => g.id === activeGlossaryId);
  const activeTerm = activeGlossary?.terms.find(t => t.id === activeTermId);

  if (activeTermId && activeTerm) return <TermSelectedState term={activeTerm} />;
  if (activeNodeId) return <NodeSelectedState />;
  return <EmptyState />;
}
