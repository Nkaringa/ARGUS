import { useState } from 'react';
import type { Section } from './types';
import { Sidebar } from './components/Layout/Sidebar';
import { StatusBar } from './components/Layout/StatusBar';
import { ChatView } from './components/ChatView';
import { BuildView } from './components/BuildView';
import { WarzoneView } from './components/WarzoneView';
import { LogsView } from './components/LogsView';
import { HistoryView } from './components/HistoryView';
import { useBuildSocket } from './hooks/useBuildSocket';
import { useChatSocket } from './hooks/useChatSocket';
import { useWarzoneSocket } from './hooks/useWarzoneSocket';

export default function App() {
  const [section, setSection] = useState<Section>('build');

  const build = useBuildSocket();
  const chat = useChatSocket();
  const warzone = useWarzoneSocket();

  const handleStop = () => {
    if (build.state !== 'idle' && build.state !== 'done') build.stop();
    if (warzone.state !== 'idle') warzone.stop();
  };

  return (
    <div
      className="flex flex-col"
      style={{ height: '100%', background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <StatusBar buildState={build.state} warzoneState={warzone.state} />

      <div
        className="flex"
        style={{
          flex: 1,
          minHeight: 0,
          paddingTop: 'var(--statusbar-height)',
        }}
      >
        <Sidebar
          current={section}
          onNavigate={setSection}
          buildState={build.state}
          warzoneState={warzone.state}
          onStop={handleStop}
        />

        <main className="flex-1 min-w-0 overflow-hidden">
          {section === 'chat-gemini' && (
            <ChatView
              agent="builder"
              agentLabel="Gemini"
              messages={chat.geminiMessages}
              onSend={chat.sendMessage}
            />
          )}
          {section === 'chat-claude' && (
            <ChatView
              agent="planner"
              agentLabel="Claude"
              messages={chat.claudeMessages}
              onSend={chat.sendMessage}
            />
          )}
          {section === 'chat-codex' && (
            <ChatView
              agent="codex_auditor"
              agentLabel="Codex"
              messages={chat.codexMessages}
              onSend={chat.sendMessage}
            />
          )}
          {section === 'build' && (
            <BuildView
              state={build.state}
              task={build.task}
              iteration={build.iteration}
              grade={build.grade}
              slug={build.slug}
              stageStartedAt={build.stageStartedAt}
              lines={build.lines}
              droppedLineCount={build.droppedLineCount}
              projects={build.projects}
              onSubmit={build.submitTask}
              onApprove={() => build.sendApproval('approve')}
              onSkip={() => build.sendApproval('skip')}
              onRetry={() => build.sendApproval('retry')}
              onAbort={() => build.sendApproval('abort')}
            />
          )}
          {section === 'warzone' && (
            <WarzoneView
              state={warzone.state}
              idea={warzone.idea}
              slug={warzone.slug}
              lines={warzone.lines}
              droppedLineCount={warzone.droppedLineCount}
              onSubmit={warzone.submitIdea}
              onApprove={() => warzone.sendApproval('approve')}
              onAbort={() => warzone.sendApproval('abort')}
              onNewDiscussion={warzone.newDiscussion}
            />
          )}
          {section === 'logs' && <LogsView history={build.history} />}
          {section === 'archive' && <HistoryView />}
        </main>
      </div>
    </div>
  );
}
