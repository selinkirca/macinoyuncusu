"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    phone: '',
    email: '',
    password: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validatePassword = (pass: string) => {
    const minLength = pass.length >= 6;
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    return minLength && hasUpper && hasLower && hasNumber && hasSymbol;
  };

  const handleAuth = async () => {
    setLoading(true);
    const { email, password, username, firstName, lastName, phone } = formData;

    try {
      if (isSignUp) {
        if (!firstName || !lastName || !username || !phone || !email || !password) {
            alert("Lütfen tüm alanları doldurun!");
            setLoading(false);
            return;
        }

        if (!validatePassword(password)) {
          alert("Şifre en az 6 karakter olmalı; büyük harf, küçük harf, sayı ve sembol içermelidir!");
          setLoading(false);
          return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { 
            data: { 
              username, 
              first_name: firstName, 
              last_name: lastName, 
              phone_number: phone 
            } 
          }
        });

        if (signUpError) throw signUpError;

        const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (signInError) throw signInError;
        router.push('/');

      } else {
        let loginEmail = email;

        if (!email.includes('@')) {
          const { data: userData } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', email)
            .maybeSingle();
            
          if (userData) {
            loginEmail = userData.email;
          } else {
             alert("Kullanıcı adı bulunamadı.");
             setLoading(false);
             return;
          }
        }

        const { error: loginError } = await supabase.auth.signInWithPassword({ 
          email: loginEmail, 
          password 
        });

        if (loginError) throw loginError;
        router.push('/');
      }
    } catch (error: any) {
      alert(error.message || "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white p-4 font-sans">
      <div className="bg-[#0a0a0a] p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-white/5">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-black italic uppercase tracking-tighter">
                ELITE 5 <span className="text-blue-500">{isSignUp ? 'JOIN' : 'LOGIN'}</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-2 italic">
                {isSignUp ? 'Kadroya dahil ol' : 'Sahaya geri dön'}
            </p>
        </div>
        
        <div className="space-y-3">
          {isSignUp && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="firstName" type="text" placeholder="Ad"
                  className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 outline-none focus:border-blue-500 text-sm font-medium transition-all"
                  onChange={handleChange}
                />
                <input
                  name="lastName" type="text" placeholder="Soyad"
                  className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 outline-none focus:border-blue-500 text-sm font-medium transition-all"
                  onChange={handleChange}
                />
              </div>
              <input
                name="username" type="text" placeholder="Kullanıcı Adı"
                className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 outline-none focus:border-blue-500 text-sm font-medium transition-all"
                onChange={handleChange}
              />
              <input
                name="phone" type="tel" placeholder="Telefon (05xx...)"
                className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 outline-none focus:border-blue-500 text-sm font-medium transition-all"
                onChange={handleChange}
              />
            </>
          )}
          
          <input
            name="email" type="text" 
            placeholder={isSignUp ? "E-posta Adresi" : "E-posta veya Kullanıcı Adı"}
            className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 outline-none focus:border-blue-500 text-sm font-medium transition-all"
            onChange={handleChange}
          />
          
          <input
            name="password" type="password" placeholder="Şifre"
            className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 outline-none focus:border-blue-500 text-sm font-medium transition-all"
            onChange={handleChange}
          />
        </div>

        <button 
          onClick={handleAuth}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 p-4 rounded-2xl font-black text-[11px] uppercase tracking-widest mt-8 transition-all shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50"
        >
          {loading ? 'HAZIRLANIYOR...' : (isSignUp ? 'KAYDI TAMAMLA' : 'GİRİŞ YAP')}
        </button>

        <p className="mt-6 text-center text-gray-500 text-[10px] font-bold uppercase tracking-wider">
          {isSignUp ? 'Zaten bir hesabın var mı?' : 'Henüz bir hesabın yok mu?'}
          <span 
            className="text-blue-500 cursor-pointer ml-2 hover:underline"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? 'GİRİŞ YAP' : 'HEMEN KAYDOL'}
          </span>
        </p>
      </div>
    </div>
  );
}