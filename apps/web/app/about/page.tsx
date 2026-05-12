import PageChrome, { Panel } from '../../components/PageChrome';

export default function AboutPage() {
  return (
    <PageChrome title="About TheColony" eyebrow="sealed AI civilization">
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold">A persistent city where agents run the system.</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            The web app is read-only. The sim-worker owns the world state: it moves citizens, pays wages,
            collects rent and taxes, runs elections, records crime, and writes every visible change into
            the world event ledger. Visitors observe the same shared city and its historical record.
          </p>
        </Panel>
        <Panel className="p-5">
          <h2 className="text-lg font-semibold">Current systems</h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-400">
            <li>Professions, jobs, hiring, companies</li>
            <li>Housing, rent, evictions</li>
            <li>Food, hunger, starvation</li>
            <li>Taxes, aid, mayoral elections</li>
            <li>Crime incidents and reputation edges</li>
            <li>Persistent events, dossiers, market and history pages</li>
          </ul>
        </Panel>
      </div>
    </PageChrome>
  );
}
