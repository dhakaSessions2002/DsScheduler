import { useState, useEffect, useCallback } from 'react';
import { studioApi, accessApi } from '@/api/base44Client';

export function useStudioData(user) {
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [chatSummary, setChatSummary] = useState([]);
    const [chatUnreadCount, setChatUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [accessStatus, setAccessStatus] = useState(null); // null = checking
    const [accessRecords, setAccessRecords] = useState([]);

    const isAdmin = user?.role === 'admin';
    const userId = user?.id;

    const callApi = useCallback(async (op, payload = {}) => {
        try {
            const data = await studioApi.call(op, payload);
            return data;
        } catch (e) {
            const status = e?.status;
            if (status === 403) {
                try {
                    const r = await accessApi.getStatus();
                    setAccessStatus(r.status || 'removed');
                } catch (_) {
                    setAccessStatus('removed');
                }
            }
            throw e;
        }
    }, []);

    const loadAll = useCallback(async () => {
        if (!userId) return;
        try {
            setLoading(true);
            const data = await callApi('load');
            setTasks(data.tasks || []);
            setNotifications(data.notifications || []);
            setLeaveRequests(data.leaveRequests || []);
            setUsers(data.users || []);
        } catch (e) {
            console.error('load failed', e);
        } finally {
            setLoading(false);
        }
    }, [userId, callApi]);

    const refreshAccess = useCallback(async () => {
        try {
            const acc = await callApi('loadAccess');
            setAccessRecords(acc.rows || []);
        } catch (e) {
            console.error('loadAccess failed', e);
        }
    }, [callApi]);

    const loadChatSummary = useCallback(async () => {
        if (!userId) return;
        try {
            const data = await callApi('loadChatSummary');
            setChatSummary(data.conversations || []);
            setChatUnreadCount(data.unreadTotal || 0);
        } catch (e) {
            console.error('loadChatSummary failed', e);
        }
    }, [userId, callApi]);

    // Polling for chat summary every 5 seconds
    useEffect(() => {
        if (accessStatus !== 'admin' && accessStatus !== 'approved') return;
        
        loadChatSummary();
        const interval = setInterval(() => {
            loadChatSummary();
        }, 5000);
        
        return () => clearInterval(interval);
    }, [accessStatus, loadChatSummary]);

    // On mount / user change: resolve approval status first, then load data only if allowed.
    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!userId) return;
            try {
                const res = await accessApi.getStatus();
                const st = res.status;
                if (!mounted) return;
                setAccessStatus(st);
                if (st === 'admin' || st === 'approved') {
                    await loadAll();
                    if (isAdmin) await refreshAccess();
                } else {
                    setLoading(false);
                }
            } catch (e) {
                console.error('status check failed', e);
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [userId, isAdmin, loadAll, refreshAccess]);

    const createTask = useCallback(
        async (data) => {
            await callApi('createTask', { task: data });
            await loadAll();
        },
        [callApi, loadAll]
    );

    const completeTask = useCallback(
        async (task) => {
            await callApi('completeTask', { task });
            await loadAll();
        },
        [callApi, loadAll]
    );

    const submitLeave = useCallback(
        async (data) => {
            await callApi('submitLeave', { leave: data });
            await loadAll();
        },
        [callApi, loadAll]
    );

    const respondLeave = useCallback(
        async (req, status) => {
            await callApi('respondLeave', { request: req, status });
            await loadAll();
        },
        [callApi, loadAll]
    );

    const markAllRead = useCallback(async () => {
        const unread = notifications.filter((n) => !n.read).map((n) => n.id);
        if (!unread.length) return;
        await callApi('markNotificationsRead', { ids: unread });
        await loadAll();
    }, [notifications, callApi, loadAll]);

    const deleteNotification = useCallback(
        async (notificationId) => {
            await callApi('deleteNotification', { notificationId });
            await loadAll();
        },
        [callApi, loadAll]
    );

    const clearAllNotifications = useCallback(async () => {
        if (!notifications.length) return;
        await callApi('clearNotifications');
        await loadAll();
    }, [notifications.length, callApi, loadAll]);

    const deleteTask = useCallback(
        async (task) => {
            await callApi('deleteTask', { taskId: task.id });
            await loadAll();
        },
        [callApi, loadAll]
    );

    const updateTaskNotes = useCallback(
        async (task, notes) => {
            await callApi('updateTaskNotes', { taskId: task.id, notes });
            await loadAll();
        },
        [callApi, loadAll]
    );

    const inviteEmployee = useCallback(
        async (email) => {
            await callApi('inviteEmployee', { email });
            await loadAll();
            await refreshAccess();
        },
        [callApi, loadAll, refreshAccess]
    );

    const removeEmployee = useCallback(
        async (employee) => {
            await callApi('removeEmployee', { userId: employee.user_id || employee.id });
            await loadAll();
            await refreshAccess();
        },
        [callApi, loadAll, refreshAccess]
    );

    const deleteAccessRecord = useCallback(
        async (emp) => {
            await callApi('deleteAccess', { userId: emp.user_id || emp.id });
            await refreshAccess();
        },
        [callApi, refreshAccess]
    );

    const approveEmployee = useCallback(
        async (emp) => {
            await callApi('approve', { userId: emp.user_id });
            await refreshAccess();
        },
        [callApi, refreshAccess]
    );

    const denyEmployee = useCallback(
        async (emp, reason) => {
            await callApi('deny', { userId: emp.user_id, reason });
            await refreshAccess();
        },
        [callApi, refreshAccess]
    );

    const requestAccess = useCallback(async () => {
        try {
            const res = await accessApi.getStatus({ request: true });
            setAccessStatus(res.status || 'pending');
            setLoading(false);
        } catch (e) {
            console.error('requestAccess failed', e);
        }
    }, []);

    const loadMessages = useCallback(
        async (conversationId) => {
            const data = await callApi('loadMessages', { conversationId });
            // Loading messages also marks them as read, so refresh summary
            loadChatSummary();
            return data.messages || [];
        },
        [callApi, loadChatSummary]
    );

    const sendMessage = useCallback(
        async (conversationId, text) => {
            const data = await callApi('sendMessage', { conversationId, text });
            loadChatSummary();
            return data.message;
        },
        [callApi, loadChatSummary]
    );

    return {
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
        inviteEmployee,
        removeEmployee,
        deleteAccessRecord,
        approveEmployee,
        denyEmployee,
        requestAccess,
        chatSummary,
        chatUnreadCount,
        loadMessages,
        sendMessage,
        reload: loadAll,
    };
}
