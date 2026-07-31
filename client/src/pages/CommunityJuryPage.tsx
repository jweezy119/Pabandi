import { CommunityJury } from '../components/CommunityJury';

export const CommunityJuryPage = () => {
  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-lg mx-auto">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Community Jury</h1>
          <p className="text-xs text-zinc-500">Peer voting for open disputes. Trust Score &gt;90 eligible.</p>
        </div>

        <CommunityJury />
      </div>
    </div>
  );
};
