"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [filteredList, setFilteredList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true);
        // DOĞRUDAN PROFİLLERİ PUAN SIRALAMASINA GÖRE ÇEKİYORUZ
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, total_points')
          .order('total_points', { ascending: false });

        if (error) throw error;

        const formattedList = data?.map(profile => ({
          id: profile.id,
          name: profile.username || `Oyuncu_${profile.id.substring(0, 4)}`,
          avatar: profile.avatar_url,
          points: profile.total_points || 0
        })) || [];

        setLeaderboard(formattedList);
        setFilteredList(formattedList);
      } catch (err) {
        console.error("Liderlik tablosu hatası:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  // Arama Fonksiyonu
  useEffect(() => {
    const results = leaderboard.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredList(results);
  }, [searchTerm, leaderboard]);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center text-blue-500 font-black italic tracking-[0.5em] animate-pulse uppercase">
        Sıralama Hesaplanıyor...
    </div>
  );

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-10 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
            <Link href="/" className="text-blue-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-white transition-all order-2 md:order-1">
            ← SAHAYA DÖN
            </Link>
            
            <div className="relative w-full md:w-72 order-1 md:order-2">
                <input 
                    type="text" 
                    placeholder="OYUNCU ARA..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-10 text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-500/50 transition-all"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-xs">🔍</span>
            </div>
        </div>

        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter uppercase mb-4">
            LİDERLİK <span className="text-blue-600">KÜRSÜSÜ</span>
          </h1>
          <p className="text-gray-500 text-[10px] font-bold tracking-[0.5em] uppercase opacity-60 italic">Maçın Yıldızı puan sıralaması.</p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">
                <th className="p-8 text-center w-24">SIRA</th>
                <th className="p-8">OYUNCU</th>
                <th className="p-8 text-right">TOPLAM PUAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredList.map((user, index) => {
                const originalRank = leaderboard.findIndex(u => u.id === user.id) + 1;
                
                return (
                  <tr key={user.id} className={`group transition-all hover:bg-white/[0.03] ${originalRank === 1 ? 'bg-blue-600/5' : ''}`}>
                    <td className="p-8 text-center">
                      <div className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm italic transition-transform group-hover:scale-110 ${
                        originalRank === 1 ? 'bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)]' : 
                        originalRank === 2 ? 'bg-slate-300 text-black' : 
                        originalRank === 3 ? 'bg-amber-600 text-black' : 'bg-white/10 text-gray-400'
                      }`}>
                        {originalRank}
                      </div>
                    </td>

                    <td className="p-8">
                      <Link href={`/profile/${user.id}`} className="flex items-center gap-4 group/item max-w-fit">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 bg-gray-900 flex-shrink-0">
                          <img 
                            src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=random`} 
                            className="w-full h-full object-cover" 
                            alt="avatar"
                            onError={(e: any) => { e.target.src = `https://ui-avatars.com/api/?name=${user.name}&background=random` }}
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className={`font-black italic uppercase tracking-tight transition-colors ${
                            originalRank === 1 ? 'text-yellow-500 text-xl' : 'text-white text-md group-hover/item:text-blue-500'
                          }`}>
                            {user.name}
                          </span>
                          {originalRank === 1 && <span className="text-[8px] text-yellow-500/50 font-black tracking-[0.2em]">LİG LİDERİ</span>}
                        </div>
                      </Link>
                    </td>

                    <td className="p-8 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`text-3xl font-black italic tabular-nums leading-none ${
                          originalRank === 1 ? 'text-yellow-500' : 'text-white'
                        }`}>
                          {user.points}
                        </span>
                        <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest mt-1">PTS</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredList.length === 0 && (
            <div className="p-24 text-center">
              <p className="text-gray-700 text-xs font-black uppercase tracking-widest italic opacity-50">
                BULUNAMADI.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}