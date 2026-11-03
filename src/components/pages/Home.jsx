'use client';

import React, { useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useStudioData } from '@/hooks/useStudioData';
import Layout from '@/components/Layout';
import AccessGate from '@/components/AccessGate';
import MasterCalendar from '@/components/MasterCalendar';
import CreateTaskForm from '@/components/CreateTaskForm';
import UrgentDeadlinesStack from '@/components/UrgentDeadlinesStack';
import TaskCard from '@/components/TaskCard';
import LeavePanel from '@/components/LeavePanel';
import EmployeeRoster from '@/components/EmployeeRoster';
import NotificationsPanel from '@/components/NotificationsPanel';
import MessagesPanel from '@/components/MessagesPanel';
import { formatLongDateBD, dhakaHour } from '@/lib/datetime';
import { getPendingWarning, PLATFORMS } from '@/lib/status';

export default function Home() {
    const { user, logout } = useAuth();
    const {
        tasks,
        users,
        notifications,
        leaveRequests,
        loading,
        isAdmin,
        accessStatus,
        accessRecords,
        createTask,
        completeTask,
        submitLeave,
        respondLeave,
        markAllRead,
        deleteNotification,
        clearAllNotifications,
        deleteTask,
        updateTaskNotes,
        removeEmployee,
        deleteAccessRecord,
        approveEmployee,
        denyEmployee,
        requestAccess,
        inviteEmployee,
        chatSummary,
        chatUnreadCount,
        loadMessages,
        sendMessage,
    } = useStudioData(user);

    const [view, setView] = useState('calendar');
    const [taskFilter, setTaskFilter] = useState('all'); // 'all', 'pending', 'critical', 'completed', 'deleted'
    const [platformFilter, setPlatformFilter] = useState('all');
    const [employeeFilter, setEmployeeFilter] = useState('all');

    const myTasks = useMemo(
        () => tasks.filter((t) => t.assigned_to_id === user?.id),
        [tasks, user]
    );
    const unreadCount = notifications.filter((n) => !n.read).length;
    const activeTasks = tasks.filter((t) => !t.deleted);
    const pendingCount = activeTasks.filter((t) => t.status !== 'completed').length;
    const criticalCount = activeTasks.filter((t) => getPendingWarning(t)?.level === 3).length;
    const pendingAccessCount = isAdmin ? (accessRecords || []).filter(r => r.status === 'pending').length : 0;
    const pendingLeaveCount = isAdmin ? (leaveRequests || []).filter(r => r.status === 'pending').length : 0;
    const totalAlertsCount = unreadCount + pendingAccessCount + pendingLeaveCount;

    const visibleTasks = isAdmin ? tasks : myTasks;
    const activeVisibleTasks = visibleTasks.filter((t) => !t.deleted);

    const greeting = (() => {
        const h = dhakaHour();
        if (h < 12) return 'Good morning';
        if (h < 18) return 'Good afternoon';
        return 'Good evening';
    })();

    const handleStatClick = (type) => {
        if (type === 'notifications') {
            setView('notifications');
        } else if (type === 'pending') {
            setView('tasks');
            setTaskFilter('pending');
        } else if (type === 'critical') {
            setView('tasks');
            setTaskFilter('critical');
        } else if (type === 'total') {
            setView('tasks');
            setTaskFilter('all');
        }
    };

    // Still resolving approval status
    if (!accessStatus) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#080808]">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#333333] border-t-[#FFFFFF]" />
            </div>
        );
    }

    // Pending / denied / removed employees never reach protected data.
    if (accessStatus !== 'admin' && accessStatus !== 'approved') {
        return <AccessGate status={accessStatus} onRequest={requestAccess} onLogout={() => logout()} />;
    }

    return (
        <Layout view={view} setView={setView} unreadCount={totalAlertsCount} chatUnreadCount={chatUnreadCount} isAdmin={isAdmin}>
            <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8 sm:py-10">
                {/* Hero header */}
                <header className="mb-8">
                    <p className="text-[11px] uppercase tracking-[0.25em] text-[#A3A3A3]">
                        {formatLongDateBD()}
                    </p>
                    <h1 className="header-clamp font-display font-bold text-[#FFFFFF]">
                        {greeting}
                    </h1>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Stat label="Pending tasks" value={pendingCount} onClick={() => { setView('tasks'); setTaskFilter('pending'); setPlatformFilter('all'); setEmployeeFilter('all'); }} />
                        <Stat label={isAdmin ? 'Total active' : 'My active tasks'} value={activeVisibleTasks.length} onClick={() => { setView('tasks'); setTaskFilter('all'); setPlatformFilter('all'); setEmployeeFilter('all'); }} />
                        <Stat label="Unread alerts" value={totalAlertsCount} accent={totalAlertsCount > 0} onClick={() => handleStatClick('notifications')} />
                        {isAdmin && (
                            <Stat label="Pending 3+ days" value={criticalCount} accentColor={criticalCount > 0 ? '#ef4444' : undefined} onClick={() => { setView('tasks'); setTaskFilter('critical'); setPlatformFilter('all'); setEmployeeFilter('all'); }} />
                        )}
                    </div>
                </header>

                {loading ? (
                    <div className="flex h-64 items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#333333] border-t-[#FFFFFF]" />
                    </div>
                ) : view === 'calendar' ? (
                    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                        <div>
                            <SectionTitle>Master Calendar</SectionTitle>
                            <MasterCalendar tasks={activeVisibleTasks} user={user} isAdmin={isAdmin} onComplete={completeTask} onDelete={deleteTask} />
                        </div>
                        <div className="space-y-4">
                            {isAdmin && <CreateTaskForm users={users} onCreate={createTask} />}
                            <UrgentDeadlinesStack tasks={activeVisibleTasks} />
                        </div>
                    </div>
                ) : view === 'tasks' ? (
                    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                        <div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                                <SectionTitle>{isAdmin ? 'Task Dashboard' : 'My Tasks'}</SectionTitle>
                            </div>

                            {/* Detailed Filtering UI */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 bg-[#141414] p-4 rounded-[8px] border border-[#333333]">
                                <div className="flex flex-col gap-1.5 flex-1">
                                    <label className="text-[10px] uppercase tracking-wider text-[#C4C4C4]">Status</label>
                                    <select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)} className="bg-[#080808] border border-[#333333] rounded-[6px] text-[13px] text-[#FFFFFF] p-2 focus:border-[#FFFFFF] focus:outline-none">
                                        <option value="all">All Active</option>
                                        <option value="pending">Pending Only</option>
                                        <option value="completed">Completed Only</option>
                                        {isAdmin && <option value="critical">3+ Days Late</option>}
                                        {isAdmin && <option value="deleted">Deleted Tasks</option>}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-1.5 flex-1">
                                    <label className="text-[10px] uppercase tracking-wider text-[#C4C4C4]">Platform</label>
                                    <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="bg-[#080808] border border-[#333333] rounded-[6px] text-[13px] text-[#FFFFFF] p-2 focus:border-[#FFFFFF] focus:outline-none">
                                        <option value="all">All Platforms</option>
                                        {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                    </select>
                                </div>

                                {isAdmin && (
                                    <div className="flex flex-col gap-1.5 flex-1">
                                        <label className="text-[10px] uppercase tracking-wider text-[#C4C4C4]">Employee</label>
                                        <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="bg-[#080808] border border-[#333333] rounded-[6px] text-[13px] text-[#FFFFFF] p-2 focus:border-[#FFFFFF] focus:outline-none">
                                            <option value="all">All Employees</option>
                                            {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {(() => {
                                let displayed = visibleTasks;

                                if (taskFilter === 'deleted') {
                                    displayed = displayed.filter(t => t.deleted);
                                } else {
                                    displayed = displayed.filter(t => !t.deleted);
                                    if (taskFilter === 'pending') displayed = displayed.filter(t => t.status !== 'completed');
                                    if (taskFilter === 'completed') displayed = displayed.filter(t => t.status === 'completed');
                                    if (taskFilter === 'critical') displayed = displayed.filter(t => getPendingWarning(t)?.level === 3);
                                }

                                if (platformFilter !== 'all') {
                                    displayed = displayed.filter(t => t.platform === platformFilter);
                                }

                                if (employeeFilter !== 'all') {
                                    displayed = displayed.filter(t => t.assigned_to_id === employeeFilter);
                                }

                                const filteredCount = displayed.length;
                                const filteredPending = displayed.filter(t => t.status !== 'completed').length;
                                const filteredCompleted = displayed.filter(t => t.status === 'completed').length;

                                return (
                                    <>
                                        <div className="mb-4 text-[12px] text-[#A3A3A3]">
                                            Showing <strong className="text-[#FFFFFF]">{filteredCount}</strong> tasks
                                            ({filteredPending} pending, {filteredCompleted} completed)
                                        </div>
                                        {displayed.length === 0 ? (
                                            <EmptyState message="No tasks match the selected filters." />
                                        ) : (
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                {displayed
                                                    .slice()
                                                    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
                                                    .map((t) => (
                                                        <TaskCard key={t.id} task={t} user={user} isAdmin={isAdmin} onComplete={completeTask} onDelete={deleteTask} onUpdateNotes={updateTaskNotes} />
                                                    ))}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                        <div className="space-y-4">
                            <UrgentDeadlinesStack tasks={activeVisibleTasks} />
                        </div>
                    </div>
                ) : view === 'team' ? (
                    isAdmin ? (
                        <div>
                            <SectionTitle>Team & Access</SectionTitle>
                            <EmployeeRoster
                                records={accessRecords}
                                tasks={tasks}
                                onApprove={approveEmployee}
                                onDeny={denyEmployee}
                                onRemove={removeEmployee}
                                onDelete={deleteAccessRecord}
                                onInvite={inviteEmployee}
                            />
                        </div>
                    ) : (
                        <EmptyState message="Admins only." />
                    )
                ) : view === 'leave' ? (
                    <LeavePanel isAdmin={isAdmin} leaveRequests={leaveRequests} onSubmit={submitLeave} onRespond={respondLeave} />
                ) : view === 'messages' ? (
                    <MessagesPanel chatSummary={chatSummary} loadMessages={loadMessages} sendMessage={sendMessage} isAdmin={isAdmin} />
                ) : (
                    <NotificationsPanel
                        notifications={notifications}
                        onMarkAllRead={markAllRead}
                        onDeleteNotification={deleteNotification}
                        onClearAllNotifications={clearAllNotifications}
                        isAdmin={isAdmin}
                        accessRecords={accessRecords}
                        leaveRequests={leaveRequests}
                        onApprove={approveEmployee}
                        onDeny={denyEmployee}
                        onRespondLeave={respondLeave}
                        onGoToTeam={() => setView('team')}
                        onGoToLeave={() => setView('leave')}
                    />
                )}
            </div>
        </Layout>
    );
}

function Stat({ label, value, accent, accentColor, onClick }) {
    const color = accentColor || (accent ? '#F59E0B' : undefined);
    return (
        <button
            onClick={onClick}
            className="rounded-[6px] border border-[#333333] bg-[#141414] px-4 py-2.5 text-left transition-colors hover:border-[#484848] hover:bg-[#1F1F1F]"
            style={accentColor ? { borderColor: accentColor } : undefined}
        >
            <p className="font-display text-2xl font-bold leading-none text-[#FFFFFF]" style={color ? { color } : undefined}>
                {value}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-[#A3A3A3]">{label}</p>
        </button>
    );
}

function SectionTitle({ children }) {
    return (
        <h2 className="mb-4 font-display text-[13px] font-semibold uppercase tracking-[0.15em] text-[#C4C4C4]">
            {children}
        </h2>
    );
}

function EmptyState({ message }) {
    return (
        <div className="rounded-[6px] border border-[#333333] bg-[#141414] p-10 text-center">
            <p className="text-[13px] text-[#A3A3A3]">{message}</p>
        </div>
    );
}
