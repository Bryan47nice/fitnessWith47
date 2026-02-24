import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';


function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /Line|FBAN|FBAV|Instagram|Snapchat|MicroMessenger|WeChat/i.test(ua) ||
    (ua.includes('Android') && !/Chrome\/\d/.test(ua)) ||
    (/iPhone|iPad/.test(ua) && !/Safari\/\d/.test(ua) && !/CriOS\/\d/.test(ua));
}

export default function Login() {
  const [signingIn, setSigningIn] = useState(false);
  const inApp = isInAppBrowser();
  const appUrl = 'https://fitnesswith47.web.app';

  async function handleGoogleLogin() {
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
      setSigningIn(false);
    }
  }

  if (signingIn) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          fontSize: '28px', fontWeight: 900, letterSpacing: '0.1em',
          background: 'linear-gradient(90deg, #ff6a00, #ffd700)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase',
        }}>
          FitForge
        </div>
      </div>
    );
  }

  function copyLink() {
    navigator.clipboard.writeText(appUrl)
      .then(() => alert('✅ 已複製！請開啟 Chrome 或 Safari，貼上網址後再登入。'))
      .catch(() => alert('請手動複製此網址：' + appUrl));
  }

  const bgStyle = {
    minHeight: '100vh',
    background: '#0a0a0f',
    color: '#e8e4dc',
    fontFamily: "'Barlow Condensed', 'Noto Sans TC', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  };

  const gradient = (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none',
      background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,90,0,0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 90% 90%, rgba(255,180,0,0.07) 0%, transparent 60%)',
    }} />
  );

  const logoBlock = (
    <>
      <div style={{
        fontSize: '60px', fontWeight: 900, letterSpacing: '0.05em',
        background: 'linear-gradient(90deg, #ff6a00, #ffd700)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        textTransform: 'uppercase', marginBottom: '8px',
      }}>
        FitForge
      </div>
      <div style={{ color: '#666', fontSize: '16px', marginBottom: '40px', letterSpacing: '0.05em' }}>
        鍛鍊你的每一天
      </div>
    </>
  );

  // 偵測到 in-app 瀏覽器，引導用外部瀏覽器開啟
  if (inApp) {
    return (
      <div style={bgStyle}>
        {gradient}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 10, padding: '40px 24px', width: '100%', maxWidth: '400px' }}>
          {logoBlock}
          <div style={{
            background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.25)',
            borderRadius: '16px', padding: '24px', marginBottom: '24px',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#ff9500', marginBottom: '8px' }}>
              請用 Chrome 或 Safari 開啟
            </div>
            <div style={{ fontSize: '14px', color: '#888', lineHeight: '1.7' }}>
              目前的瀏覽器不支援 Google 登入。<br />
              請複製連結，貼到 Chrome 或 Safari 再登入。
            </div>
          </div>
          <button
            onClick={copyLink}
            style={{
              width: '100%', padding: '14px', border: 'none', borderRadius: '12px',
              background: 'linear-gradient(135deg, #ff6a00, #ff9500)',
              color: '#fff', fontSize: '16px', fontWeight: 800,
              cursor: 'pointer', letterSpacing: '0.06em',
            }}
          >
            📋 複製連結
          </button>
          <div style={{ color: '#555', fontSize: '12px', marginTop: '16px', wordBreak: 'break-all' }}>
            {appUrl}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={bgStyle}>
      {gradient}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 10, padding: '40px 24px', width: '100%', maxWidth: '400px' }}>
        {logoBlock}

        <div style={{ marginBottom: '48px', textAlign: 'left' }}>
          {[
            '💪 記錄訓練組數與重量',
            '📏 追蹤身材數據與 BMI',
            '🔥 連續訓練天數挑戰',
            '☁️ 雲端同步，跨裝置使用',
          ].map((f, i) => (
            <div key={i} style={{
              color: '#888', fontSize: '15px', padding: '10px 0',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              {f}
            </div>
          ))}
        </div>

        <button
          onClick={handleGoogleLogin}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            width: '100%', padding: '16px 24px',
            background: 'white', borderRadius: '12px', border: 'none',
            cursor: 'pointer', fontSize: '16px', fontWeight: 700,
            color: '#1a1a2e', letterSpacing: '0.02em',
            boxShadow: '0 4px 24px rgba(255,106,0,0.3)',
            transition: 'transform 0.1s, box-shadow 0.1s',
          }}
          onMouseOver={e => {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.boxShadow = '0 6px 32px rgba(255,106,0,0.45)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 24px rgba(255,106,0,0.3)';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          使用 Google 帳號登入
        </button>

        <div style={{ color: '#444', fontSize: '12px', marginTop: '24px' }}>
          登入即表示你同意我們的服務條款
        </div>
      </div>
    </div>
  );
}
