"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeague, setSelectedLeague] = useState("PL");
  const [matchPlayersMap, setMatchPlayersMap] = useState<{ [key: number]: any[] }>({});
  const [localMvpSelections, setLocalMvpSelections] = useState<{ [key: number]: string }>({});
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const ADMIN_EMAIL = "selin.kirca.41@gmail.com";

  useEffect(() => {
    checkAdmin();
    fetchMatches();
  }, [selectedLeague]);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== ADMIN_EMAIL) {
      router.push('/');
    }
  };

  const fetchMatches = async () => {
    setLoading(true);
    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .eq('competition_code', selectedLeague)
      .order('match_time', { ascending: false });

    setMatches(matchData || []);
    setLoading(false);
  };

  const loadMatchPlayers = async (homeTeam: string, awayTeam: string, matchId: number) => {
    if (matchPlayersMap[matchId]) return;
    const { data } = await supabase
      .from('players')
      .select('player_name, team_name')
      .or(`team_name.eq."${homeTeam}",team_name.eq."${awayTeam}"`)
      .order('player_name', { ascending: true });

    if (data) {
      setMatchPlayersMap(prev => ({ ...prev, [matchId]: data }));
    }
  };

  const handleSetMvp = async (matchId: number) => {
    const selectedMvp = localMvpSelections[matchId];
    if (!selectedMvp) return alert("Lütfen önce bir oyuncu seçin!");

    setUpdatingId(matchId);
    // VERİTABANINA KALICI YAZMA
    const { error } = await supabase
      .from('matches')
      .update({
        mvp_name: selectedMvp,
        status: 'FINISHED' 
      })
      .eq('id', matchId);

    if (error) {
      alert("Hata: " + error.message);
    } else {
      alert("MVP Kaydedildi! Puan motoru 15 puanı (10+5) dağıtacak. 🚀");
      fetchMatches(); // Sayfayı yenileyip veriyi tablodan çekiyoruz
    }
    setUpdatingId(null);
  };

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-black italic animate-pulse">ADMIN SISTEM...</div>;

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-10 bg-white/5 p-8 rounded-[3rem] border border-white/10">
          <h1 className="text-3xl font-black italic uppercase">ELITE 5 <span className="text-blue-500">ADMIN</span></h1>
          <button onClick={() => router.push('/')} className="bg-white/10 hover:bg-blue-600 px-8 py-3 rounded-2xl text-[10px] font-black transition-all">SİTEYE DÖN</button>
        </div>

        <div className="flex gap-3 mb-10 overflow-x-auto pb-4">
          {["PL", "PD", "BL1", "SA", "FL1"].map((l) => (
            <button key={l} onClick={() => setSelectedLeague(l)} className={`px-8 py-4 rounded-2xl text-[10px] font-black border transition-all ${selectedLeague === l ? 'bg-blue-600 border-blue-400' : 'bg-white/5 border-white/5 text-gray-500'}`}>{l}</button>
          ))}
        </div>

        <div className="grid gap-6">
          {matches.map((match) => (
            <div key={match.id} className="bg-white/[0.02] border border-white/5 p-8 rounded-[3.5rem] flex flex-col lg:flex-row items-center gap-8">
              <div className="flex items-center gap-6 flex-1 min-w-[300px] justify-center">
                <span className="font-black uppercase italic">{match.home_team}</span>
                <span className="bg-blue-600 px-6 py-3 rounded-2xl font-black text-2xl italic">{match.home_score} - {match.away_score}</span>
                <span className="font-black uppercase italic">{match.away_team}</span>
              </div>

              <div className="flex-1 w-full lg:w-auto">
                <select 
                  // Veritabanındaki mvp_name değerini select'e bağlıyoruz (Kaybolmaması için)
                  value={localMvpSelections[match.id] || match.mvp_name || ""}
                  onFocus={() => loadMatchPlayers(match.home_team, match.away_team, match.id)}
                  onChange={(e) => setLocalMvpSelections(prev => ({ ...prev, [match.id]: e.target.value }))}
                  className="w-full bg-black border border-white/10 rounded-[1.5rem] px-6 py-4 text-[10px] font-black uppercase italic outline-none focus:border-blue-500"
                >
                  <option value="">{match.mvp_name ? `SEÇİLİ: ${match.mvp_name}` : "MAÇIN ADAMINI SEÇ"}</option>
                  {(matchPlayersMap[match.id] || []).map((p, idx) => (
                    <option key={idx} value={p.player_name}>{p.player_name} ({p.team_name})</option>
                  ))}
                </select>
              </div>

              <button
                disabled={updatingId === match.id}
                onClick={() => handleSetMvp(match.id)}
                className="w-full lg:w-48 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all"
              >
                {updatingId === match.id ? 'İŞLENİYOR...' : 'PUANI DAĞIT'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}