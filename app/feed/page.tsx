"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function FeedPage() {
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchFeed();
  }, []);

  async function fetchFeed() {
    setLoading(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) { window.location.href = '/login'; return; }
    setUser(currentUser);

    // 1. Önce takip ettiğin kişilerin ID'lerini al
    const { data: followingData } = await supabase
      .from('followers')
      .select('following_id')
      .eq('follower_id', currentUser.id);

    const followingIds = followingData?.map(f => f.following_id) || [];

    if (followingIds.length === 0) {
      setFeed([]);
      setLoading(false);
      return;
    }

    // 2. Bu kişilerin tahminlerini, maç ve profil bilgileriyle çek
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select(`
        *,
        matches (*),
        profiles:user_id (username, avatar_url)
      `)
      .in('user_id', followingIds)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error) setFeed(predictions || []);
    setLoading(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="animate-bounce text-blue-500 font-black italic tracking-widest">AKIS YUKLENIYOR...</div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#050505] text-white p-4 md:p-10 font-sans">
      <div className="max-w-2xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase">ELITE <span className="text-blue-600">FEED</span></h1>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.3em]">Takip ettiğin oyuncuların dünyası</p>
          </div>
          <Link href="/" className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition-all">
            🏠
          </Link>
        </header>

        <div className="space-y-8">
          {feed.map((post) => (
            <div key={post.id} className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl hover:border-blue-500/20 transition-all group">
              {/* Kullanıcı Bilgisi */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10">
                  <img 
                    src={post.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${post.profiles?.username}`} 
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div>
                  <h3 className="font-black italic uppercase text-sm">{post.profiles?.username}</h3>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Bir tahmin paylaştı</p>
                </div>
                <div className="ml-auto text-[8px] text-gray-700 font-black uppercase tracking-widest">
                  {new Date(post.created_at).toLocaleDateString('tr-TR')}
                </div>
              </div>

              {/* Tahmin Detayı */}
              <div className="bg-black/40 rounded-[2rem] p-6 border border-white/5">
                <div className="flex justify-between items-center mb-6 opacity-60">
                    <img src={post.matches?.home_logo} className="w-8 h-8 object-contain" />
                    <span className="text-[10px] font-black uppercase tracking-tighter">{post.matches?.home_team} vs {post.matches?.away_team}</span>
                    <img src={post.matches?.away_logo} className="w-8 h-8 object-contain" />
                </div>

                <div className="flex flex-col items-center gap-3">
                    <div className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em]">Tahmin</div>
                    <div className="text-2xl font-black italic uppercase tracking-tighter text-center">
                        {post.predicted_winner === 'HOME_TEAM' ? post.matches?.home_team : 
                         post.predicted_winner === 'AWAY_TEAM' ? post.matches?.away_team : 'Beraberlik'}
                    </div>
                    
                    <div className="mt-4 flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
                        <span className="text-[10px]">🌟</span>
                        <span className="text-[10px] font-black text-emerald-400 uppercase italic">MVP: {post.predicted_mvp}</span>
                    </div>
                </div>
              </div>
            </div>
          ))}

          {feed.length === 0 && (
            <div className="text-center py-20 bg-white/5 rounded-[3rem] border border-dashed border-white/10">
              <p className="text-gray-500 font-bold italic uppercase text-xs tracking-widest mb-4">Henüz kimseyi takip etmiyorsun <br/>veya takip ettiklerin henüz tahmin yapmadı.</p>
              <Link href="/leaderboard" className="text-blue-500 font-black text-[10px] uppercase underline tracking-widest">Oyuncuları Keşfet</Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}