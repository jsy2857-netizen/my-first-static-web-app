import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import { fetchDashboardData } from './utils/dataHandler';

/* ───────────────────────────────────────────────
   대시보드 컴포넌트  (DB 연동)
─────────────────────────────────────────────── */
function Dashboard({ onSiteClick }) {
  const [dashData, setDashData]   = useState(null);   // fetchDashboardData 결과
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState(null);
  const [lastSync, setLastSync]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardData();
      setDashData(data);
      setLastSync(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      setError(err.message || 'DB 데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  // 최초 로드 + 60초마다 자동 갱신
  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  // ── 계약 만료일 포맷 ──────────────────────
  const fmtDate = (val) => {
    if (!val) return '—';
    const d = new Date(val);
    return isNaN(d) ? val : d.toLocaleDateString('ko-KR');
  };

  // ── 계약 상태 계산 ────────────────────────
  const getContractStatus = (site) => {
    if (!site.hasActiveContract) return 'offline';
    const exp = site.contract?.expireDate ? new Date(site.contract.expireDate) : null;
    if (!exp) return 'online';
    const daysLeft = (exp - new Date()) / (1000 * 60 * 60 * 24);
    return daysLeft <= 30 ? 'warning' : 'online';
  };

  const statusLabel = { online: '정상', warning: '만료임박', offline: '미계약' };

  // ── 통계 카드 데이터 (총 현장 수만 표시) ──────────────────────
  const stats = [
    {
      label: '총 현장 수',
      value: dashData ? String(dashData.totalSites) : '—',
      unit: '개', icon: '🏭', color: 'blue',
    },
  ];

  return (
    <aside className="dashboard">
      {/* 헤더 */}
      <div className="dashboard-header">
        <span className="dashboard-title-icon">📊</span>
        <h2 className="dashboard-title">현장 대시보드</h2>
        <button className="db-refresh-btn" onClick={load} disabled={loading} title="새로고침">
          <span className={loading ? 'spin' : ''}>🔄</span>
        </button>
      </div>

      {/* 동기화 시각 */}
      {lastSync && (
        <div className="sync-time">🕐 {lastSync} 동기화</div>
      )}

      {/* 에러 배너 */}
      {error && (
        <div className="db-error-banner">
          <span>⚠️ {error}</span>
          <button onClick={load}>재시도</button>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.label} className={`stat-card stat-${s.color} ${loading ? 'skeleton' : ''}`}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-info">
              <div className="stat-value">{s.value} <span className="stat-unit">{s.unit}</span></div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 현장 + 계약 목록 */}
      <div className="site-section">
        <div className="section-title">현장 계약 현황</div>
        {loading ? (
          <div className="db-loading">
            <span className="spinner"></span> 데이터 로딩 중...
          </div>
        ) : (
          <ul className="site-list">
            {(dashData?.sites || []).length === 0 ? (
              <li className="site-empty">데이터 없음</li>
            ) : (
              (dashData?.sites || []).map((site, idx) => {
                const status = getContractStatus(site);
                return (
                  <li
                    key={site.id_site ?? idx}
                    className="site-item site-item-clickable"
                    onClick={() => onSiteClick && onSiteClick(site.id_site)}
                    title={`현장 ID ${site.id_site} 를 입력창에 넣기`}
                  >
                    <div className="site-left">
                      <span className={`status-dot ${status}`}></span>
                      <div className="site-name-wrap">
                        <span className="site-name">{site.site_name ?? site.siteName ?? site.name ?? `현장 ${site.id_site}`}</span>
                        <span className="site-id">ID: {site.id_site}</span>
                      </div>
                    </div>
                    <div className="site-right">
                      {site.contract && (
                        <span className="site-expire">
                          ~{fmtDate(site.contract.expireDate)}
                        </span>
                      )}
                      <span className={`site-status-badge ${status}`}>{statusLabel[status]}</span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
    </aside>
  );
}

/* ───────────────────────────────────────────────
   메인 App 컴포넌트
─────────────────────────────────────────────── */
function App() {
  const [agentActive, setAgentActive] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: '안녕하세요! 현장설정 Agent입니다. 현장 정보 설정을 도와드리겠습니다. 무엇이 필요하신가요?',
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Agent 활성화 시 입력창 포커스
  useEffect(() => {
    if (agentActive) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [agentActive]);

  const simulateStreamingResponse = (userMessage) => {
    const keyword = userMessage.toLowerCase();
    let responseText;
    if (keyword.includes('현장') || keyword.includes('설정')) {
      responseText = '현장 설정 정보를 확인 중입니다. 현장 코드, 장비 목록, 운영 파라미터를 입력해 주세요. 예) 현장코드: SITE-001, 장비: ESS/PV/EV충전기';
    } else if (keyword.includes('장비') || keyword.includes('에너지')) {
      responseText = '장비 목록과 에너지 소비 현황을 조회하고 있습니다. 현재 운영 중인 장비 138대 중 3대에서 이상 신호가 감지되었습니다. 상세 확인이 필요하신가요?';
    } else if (keyword.includes('알림') || keyword.includes('이상')) {
      responseText = '이상 알림 3건을 확인했습니다: ①수원 2공장 온도 초과(28°C) ②인천 ESS 충전율 저하(12%) ③대구 라인 통신 단절. 즉시 조치가 필요합니다.';
    } else {
      responseText = '네, 말씀하신 내용을 확인했습니다. TMS 에너지 운영 시스템에서 관련 데이터를 분석 중입니다. 추가로 필요하신 사항이 있으면 말씀해 주세요.';
    }

    const fullResponse = `[현장설정 Agent] ${responseText}`;
    let currentIndex = 0;
    const streamId = Date.now();

    setMessages((prev) => [
      ...prev,
      {
        id: streamId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        streaming: true,
      },
    ]);

    const streamInterval = setInterval(() => {
      currentIndex += 3;
      const chunk = fullResponse.slice(0, currentIndex);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === streamId
            ? { ...msg, content: chunk, streaming: currentIndex < fullResponse.length }
            : msg
        )
      );
      if (currentIndex >= fullResponse.length) {
        clearInterval(streamInterval);
        setIsStreaming(false);
      }
    }, 25);
  };

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsStreaming(true);
    setTimeout(() => simulateStreamingResponse(trimmed), 400);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ── 랜딩 화면 ── */
  if (!agentActive) {
    return (
      <div className="landing">
        <div className="landing-bg" />
        <div className="landing-content">
          <div className="landing-icon">⚡</div>
          <h1 className="landing-title">TMS Energy Ops Agent</h1>
          <p className="landing-subtitle">에너지 운영 현장 관제 및 AI 자동화 플랫폼</p>
          <div className="landing-agents">
            <button
              className="landing-agent-btn"
              onClick={() => setAgentActive(true)}
            >
              <span className="landing-agent-icon">⚙️</span>
              <div className="landing-agent-info">
                <span className="landing-agent-name">현장설정 Agent</span>
                <span className="landing-agent-desc">현장 코드 · 장비 · 파라미터 설정</span>
              </div>
              <span className="landing-agent-arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── 메인 화면 (대시보드 + 채팅) ── */
  return (
    <div className="app-container">
      {/* 헤더 */}
      <header className="app-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => setAgentActive(false)}>←</button>
          <div className="header-icon">⚡</div>
          <h1 className="header-title">TMS Energy Ops Agent</h1>
        </div>
        <div className="header-badge">
          <span className="badge-dot">🟢</span>
          <span>현장설정 Agent 활성 중</span>
        </div>
      </header>

      {/* 본문: 대시보드(왼쪽) + 채팅(오른쪽) */}
      <div className="main-layout">
        <Dashboard onSiteClick={(id) => { setInputValue(String(id)); inputRef.current?.focus(); }} />

        {/* 채팅 영역 */}
        <section className="chat-section">
          <div className="chat-header">
            <span className="chat-header-icon">💬</span>
            <span className="chat-header-title">현장설정 Agent 채팅</span>
          </div>

          <div className="messages-area">
            {messages.map((msg) => (
              <div key={msg.id} className={`message-row ${msg.role}`}>
                {msg.role === 'assistant' && <div className="avatar assistant-avatar">AI</div>}
                {msg.role === 'system' && <div className="system-message">{msg.content}</div>}
                {msg.role !== 'system' && (
                  <div className={`message-bubble ${msg.role}`}>
                    <div className="message-content">
                      {msg.content}
                      {msg.streaming && <span className="cursor-blink">▌</span>}
                    </div>
                    <div className="message-time">{msg.timestamp}</div>
                  </div>
                )}
                {msg.role === 'user' && <div className="avatar user-avatar">나</div>}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <footer className="input-area">
            <div className="input-row">
              <textarea
                ref={inputRef}
                className="chat-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isStreaming ? 'AI가 응답 중입니다...' : '메시지를 입력하세요... (Enter: 전송)'}
                disabled={isStreaming}
                rows={1}
              />
              <button
                className={`send-btn ${isStreaming ? 'disabled' : ''}`}
                onClick={handleSend}
                disabled={isStreaming || !inputValue.trim()}
              >
                {isStreaming ? (
                  <span className="loading-dots">
                    <span></span><span></span><span></span>
                  </span>
                ) : '▶'}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
}

export default App;
