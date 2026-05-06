"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// --- YARDIMCI BİLEŞENLER VE FONKSİYONLAR ---

const formatCountdown = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(v => v < 10 ? "0" + v : v).join(":");
};

// Geri Sayım Sayacı Bileşeni
const CountdownTimer = ({ matchTime }: { matchTime: string }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(matchTime).getTime() - new Date().getTime();
      setTimeLeft(diff);
    };
    calculate();
    const timer = setInterval(calculate, 1000);
    return () => clearInterval(timer);
  }, [matchTime]);

  if (timeLeft <= 0) {
    return (
      <span className="text-red-500 font-black animate-pulse text-[10px] tracking-[0.3em] mt-3 uppercase">
        MAÇ BAŞLADI
      </span>
    );
  }

  // Sadece son 24 saat kala göster
  if (timeLeft > 86400000) return null;

  return (
    <div className="flex flex-col items-center mt-3 animate-in fade-in zoom-in duration-500">
      <span className="text-[8px] text-gray-500 font-bold tracking-[0.2em] mb-1">BAŞLAMASINA</span>
      <span className="text-blue-500 font-mono font-bold text-xl tracking-[0.15em] drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
        {formatCountdown(timeLeft)}
      </span>
    </div>
  );
};

export default function Home() {
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<any[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string>("ALL");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [selectedTeamForMvp, setSelectedTeamForMvp] = useState<string>("");
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [mvpName, setMvpName] = useState("");

  const ADMIN_EMAIL = "selin.kirca.41@gmail.com";

  const LEAGUE_MAPPING: any = {
    "WC": ["Argentina", "France", "Brazil", "Germany", "England", "Portugal", "Spain", "Netherlands", "Belgium", "Croatia", "Uruguay", "Senegal", "Morocco", "Japan", "Korea Republic", "USA", "Mexico", "Switzerland", "Denmark", "Poland", "Australia", "Turkey", "Italy", "Colombia", "Ecuador", "Peru", "Chile", "Sweden", "Norway", "Serbia", "Ukraine", "Ghana", "Cameroon", "Nigeria", "Tunisia", "Algeria", "Egypt", "Saudi Arabia", "Iran", "Qatar", "Canada", "Costa Rica", "Wales", "Scotland", "Austria", "Hungary", "Czech Republic"],
    "CL": ["Real Madrid", "Man City", "Bayern", "Arsenal", "Barcelona", "PSG", "Inter", "Dortmund", "Atletico", "Leverkusen", "Liverpool", "Juventus", "Benfica"],
    "PL": ["Arsenal", "Man City", "Liverpool", "Chelsea", "Man United", "Tottenham", "Aston Villa", "Newcastle", "Everton"],
    "PD": ["Real Madrid", "Barcelona", "Atletico Madrid", "Girona", "Real Sociedad", "Sevilla", "Valencia", "Athletic Club"],
    "BL1": ["Bayern", "Leverkusen", "Dortmund", "Leipzig", "Stuttgart", "Frankfurt", "Wolfsburg"],
    "SA": ["AC Milan", "Juventus FC", "Inter Milan", "AS Roma", "Napoli", "Atalanta", "Lazio", "Fiorentica", "Bologna"],
    "FL1": ["PSG", "Monaco", "Marseille", "Lille", "Lens", "Lyon", "Nice", "Rennes"],
  };

  const LEAGUES = [
    { id: "ALL", name: "TÜMÜ" },
    { id: "WC", name: "WORLD CUP 🌎" },
    { id: "CL", name: "CHAMPIONS LEAGUE 🏆" },
    { id: "PL", name: "PREMIER LEAGUE" },
    { id: "PD", name: "LA LIGA" },
    { id: "BL1", name: "BUNDESLIGA" },
    { id: "SA", name: "SERIE A" },
    { id: "FL1", name: "LIGUE 1" }
  ];

  useEffect(() => {
    const init = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      const { data, error } = await supabase.from('matches').select('*').order('match_time', { ascending: true });
      if (!error) {
        setMatches(data || []);
        setFilteredMatches(data || []);
      }
      setLoading(false);
    };
    init();
  }, [router]);

  useEffect(() => {
    let baseMatches = matches;
    if (selectedLeague !== "WC") {
      baseMatches = matches.filter(m => m.status !== 'FINISHED');
    }

    if (selectedLeague === "ALL") {
      setFilteredMatches(baseMatches);
    } else if (selectedLeague === "WC") {
      const filtered = matches.filter(m => m.competition_code === 'WC');
      setFilteredMatches(filtered);
    } else {
      const targetTeams = LEAGUE_MAPPING[selectedLeague] || [];
      const filtered = baseMatches.filter(m => 
        targetTeams.some((team: string) => m.home_team.includes(team) || m.away_team.includes(team))
      );
      setFilteredMatches(filtered);
    }
  }, [selectedLeague, matches]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) { router.push('/login'); router.refresh(); }
  };

  const fetchPlayersByTeam = async (teamName: string) => {
    setSelectedTeamForMvp(teamName);
    const { data } = await supabase.from('players').select('player_name').eq('team_name', teamName).order('player_name', { ascending: true });
    setAvailablePlayers(data || []);
  };

  const isLocked = (matchTime: string) => {
    const now = new Date().getTime();
    const gameTime = new Date(matchTime).getTime();
    return (gameTime - now) < (10 * 60 * 1000);
  };

  const submitPrediction = async (prediction: string) => {
    if (!user || !selectedMatch || !mvpName) return;
    if (isLocked(selectedMatch.match_time)) {
      alert("Maça 10 dakika kala tahmin yapılamaz!");
      setSelectedMatch(null);
      return;
    }
    const { error } = await supabase.from('predictions').upsert({
      user_id: user.id,
      match_id: selectedMatch.id,
      predicted_winner: prediction,
      predicted_mvp: mvpName,
      is_processed: false
    }, { onConflict: 'user_id,match_id' });
    if (!error) { alert("Tahmin kaydedildi! 🏆"); setSelectedMatch(null); }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-blue-500 font-black italic tracking-widest animate-pulse">MAÇIN YILDIZI...</div>;

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-10 font-sans text-center">
      
      {/* NAVBAR */}
      <nav className="max-w-6xl mx-auto flex justify-between items-center mb-10 bg-white/5 p-6 rounded-[2.5rem] border border-white/10 backdrop-blur-xl sticky top-5 z-[150] shadow-2xl">
        <Link href="/" className="flex items-center gap-3">
          <div className="bg-blue-600 w-10 h-10 rounded-full flex items-center justify-center font-black shadow-lg shadow-blue-600/20 text-white">MY</div>
          <h1 className="text-xl font-black italic tracking-tighter uppercase tracking-widest">MAÇIN<span className="text-blue-500 text-2xl">YILDIZI</span></h1>
        </Link>
        <div className="flex items-center gap-2 md:gap-4 text-[10px] font-black uppercase tracking-[0.2em]">
          <Link href="/feed" className="text-gray-400 hover:text-white transition-all hidden lg:block">Akış</Link>
          <Link href="/leaderboard" className="text-gray-400 hover:text-white transition-all hidden lg:block">Sıralama</Link>
          {user ? (
            <div className="flex items-center gap-2">
              {user.email === ADMIN_EMAIL && (
                <Link href="/admin" className="bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-black px-4 py-2.5 rounded-2xl border border-amber-500/20 transition-all animate-pulse">YÖNETİM 🛠️</Link>
              )}
              <Link href="/profile" className="bg-white/10 hover:bg-white/20 px-5 py-2.5 rounded-2xl border border-white/5 hover:bg-blue-600 transition-all text-white">Profil</Link>
              <button onClick={handleLogout} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-4 py-2.5 rounded-2xl border border-red-500/20 transition-all">Çıkış</button>
            </div>
          ) : (
            <Link href="/login" className="bg-blue-600 hover:bg-blue-500 px-6 py-2.5 rounded-2xl text-white">Giriş</Link>
          )}
        </div>
      </nav>

      {/* LİG FİLTRELEME */}
      <div className="max-w-6xl mx-auto flex flex-wrap justify-center gap-3 mb-12">
        {LEAGUES.map((l) => (
          <button key={l.id} onClick={() => setSelectedLeague(l.id)} className={`px-6 py-3 rounded-full text-[9px] font-black border transition-all tracking-widest ${selectedLeague === l.id ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-600/20' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
            {l.name}
          </button>
        ))}
      </div>

      {/* MAÇ LİSTESİ */}
      <div className="max-w-5xl mx-auto grid gap-6">
        {filteredMatches.length > 0 ? filteredMatches.map((match) => {
          // Maçın başlayıp başlamadığını kontrol et (Status veya Time bazlı)
          const isStarted = match.status === 'IN_PLAY' || match.status === 'FINISHED' || match.status === 'PAUSED' || new Date(match.match_time) <= new Date();

          return (
            <div key={match.id} className="group bg-white/[0.02] hover:bg-white/[0.03] p-8 rounded-[3.5rem] border border-white/5 flex flex-col md:flex-row items-center gap-8 transition-all relative text-left">
              <div className="flex-1 flex flex-row-reverse md:flex-row items-center justify-end gap-5 w-full">
                <span className="text-lg font-black italic uppercase tracking-tighter">{match.home_team}</span>
                <img src={match.home_logo} className="w-14 h-14 object-contain group-hover:scale-110 transition-transform" alt="home" />
              </div>

              {/* MERKEZ ALAN: SKOR VEYA TARİH/SAAT */}
              <div className="flex flex-col items-center min-w-[180px]">
                <div className="bg-black/60 px-8 py-5 rounded-[2.5rem] border border-white/10 font-black shadow-2xl flex flex-col items-center justify-center min-h-[80px]">
                  {isStarted ? (
                    // Maç başladıysa SKOR göster
                    <span className="text-3xl tabular-nums italic">
                      {match.home_score ?? 0} - {match.away_score ?? 0}
                    </span>
                  ) : (
                    // Maç başlamadıysa TARİH ve SAAT göster
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-blue-400 tracking-[0.2em] uppercase">
                        {new Date(match.match_time).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                      </span>
                      <span className="text-2xl tracking-tighter">
                        {new Date(match.match_time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
                {/* GERİ SAYIM (Son 24 saat kala CountdownTimer devreye girer) */}
                <CountdownTimer matchTime={match.match_time} />
              </div>

              <div className="flex-1 flex items-center justify-start gap-5 w-full">
                <img src={match.away_logo} className="w-14 h-14 object-contain group-hover:scale-110 transition-transform" alt="away" />
                <span className="text-lg font-black italic uppercase tracking-tighter">{match.away_team}</span>
              </div>

              <button 
                onClick={() => {
                  if (isLocked(match.match_time)) { alert("Maça 10 dakika kala veya maç başladığında tahmin yapılamaz! ⏳"); return; }
                  setSelectedMatch(match);
                }}
                disabled={match.status === 'FINISHED' || isStarted}
                className={`w-full md:w-44 py-5 rounded-[1.8rem] font-black text-[10px] tracking-widest uppercase transition-all ${
                  match.status === 'FINISHED' || isLocked(match.match_time) || (isStarted && match.status !== 'FINISHED')
                    ? 'bg-gray-900 text-gray-600 cursor-not-allowed border border-white/5' 
                    : 'bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-600/20'
                }`}
              >
                {match.status === 'FINISHED' ? 'BİTTİ' : isLocked(match.match_time) ? 'KİLİTLENDİ' : isStarted ? 'MAÇ BAŞLADI' : 'TAHMİN YAP'}
              </button>
            </div>
          );
        }) : (
            <div className="text-center py-20 bg-white/5 rounded-[3.5rem] border border-dashed border-white/10 w-full">
                <p className="text-[10px] font-black uppercase text-gray-600 tracking-[0.4em]">Seçili ligde eşleşen aktif maç bulunamadı</p>
            </div>
        )}
      </div>

      {/* TAHMİN MODALI */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl flex items-center justify-center z-[200] p-4">
          <div className="bg-[#0f0f0f] border border-white/10 p-10 rounded-[4rem] max-w-md w-full shadow-2xl relative text-center">
            <h3 className="text-2xl font-black text-center mb-8 italic uppercase tracking-tighter">MAÇIN<span className="text-blue-500 text-3xl">YILDIZI</span></h3>
            <div className="mb-6">
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button onClick={() => fetchPlayersByTeam(selectedMatch.home_team)} className={`p-4 rounded-3xl border text-[10px] font-black uppercase transition-all ${selectedTeamForMvp === selectedMatch.home_team ? 'bg-blue-600 border-blue-400 shadow-lg' : 'bg-white/5 border-white/5'}`}>{selectedMatch.home_team}</button>
                <button onClick={() => fetchPlayersByTeam(selectedMatch.away_team)} className={`p-4 rounded-3xl border text-[10px] font-black uppercase transition-all ${selectedTeamForMvp === selectedMatch.away_team ? 'bg-blue-600 border-blue-400 shadow-lg' : 'bg-white/5 border-white/5'}`}>{selectedMatch.away_team}</button>
              </div>
              {selectedTeamForMvp && (
                <select className="w-full bg-black border border-white/10 rounded-3xl p-5 text-xs font-black appearance-none text-center outline-none focus:border-blue-500 transition-all uppercase italic text-white" onChange={(e) => setMvpName(e.target.value)} value={mvpName}>
                  <option value="">-- MVP SEÇİMİ --</option>
                  {availablePlayers.map((p, i) => (<option key={i} value={p.player_name}>{p.player_name}</option>))}
                </select>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => submitPrediction('HOME_TEAM')} className="bg-white/5 hover:bg-blue-600 p-6 rounded-3xl font-black text-xl transition-all border border-white/5">1</button>
              <button onClick={() => submitPrediction('DRAW')} className="bg-white/5 hover:bg-gray-700 p-6 rounded-3xl font-black text-xl transition-all border border-white/5">X</button>
              <button onClick={() => submitPrediction('AWAY_TEAM')} className="bg-white/5 hover:bg-emerald-600 p-6 rounded-3xl font-black text-xl transition-all border border-white/5">2</button>
            </div>
            <button onClick={() => setSelectedMatch(null)} className="w-full mt-8 text-gray-700 hover:text-white text-[9px] font-black uppercase tracking-[0.5em] transition-all">Vazgeç</button>
          </div>
        </div>
      )}
    </main>
  );
}