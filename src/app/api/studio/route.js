import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/dbConnect';
import { getAuthUser } from '@/lib/auth';
import Task from '@/models/Task';
import Notification from '@/models/Notification';
import LeaveRequest from '@/models/LeaveRequest';
import EmployeeAccess from '@/models/EmployeeAccess';
import Message from '@/models/Message';
import User from '@/models/User';
import { sendInviteEmail } from '@/lib/email';

// Match an access record by either the user's id or the access record's own id
// (invited employees who haven't registered yet only have the record id).
function accessIdFilter(id) {
    const sid = String(id || '');
    if (!mongoose.Types.ObjectId.isValid(sid)) {
        throw { status: 400, message: 'Invalid employee id' };
    }
    return { $or: [{ user_id: sid }, { _id: sid }] };
}

// Helper to check admin
function requireAdmin(user) {
    if (user.role !== 'admin') {
        throw { status: 403, message: 'Admin only' };
    }
}

// Helper to check approved
async function requireApproved(user) {
    if (user.role === 'admin') return;
    const access = await EmployeeAccess.findOne({ user_id: user.id, status: 'approved' });
    if (!access) {
        throw { status: 403, message: 'Your access is not approved' };
    }
}

// Chat: 'team' is open to every approved member; 'dm:<userId>' only to that employee and admins.
function requireConversationAccess(user, conversationId) {
    if (conversationId === 'team') return;
    if (typeof conversationId === 'string' && conversationId.startsWith('dm:')) {
        const ownerId = conversationId.slice(3);
        if (!mongoose.Types.ObjectId.isValid(ownerId)) {
            throw { status: 400, message: 'Invalid conversation' };
        }
        if (user.role === 'admin' || ownerId === String(user.id)) return;
    }
    throw { status: 403, message: 'You cannot access this conversation' };
}

function toPlainMessage(m, userId) {
    return {
        id: m._id.toString(),
        conversation_id: m.conversation_id,
        sender_id: m.sender_id.toString(),
        sender_name: m.sender_name || '',
        sender_role: m.sender_role || 'user',
        text: m.text,
        created_date: m.created_date,
        is_mine: m.sender_id.toString() === String(userId),
    };
}

function toPlain(doc) {
    if (!doc) return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    obj.id = (obj._id || obj.id).toString();
    if (obj.user_id) obj.user_id = obj.user_id.toString();
    if (obj.assigned_to_id) obj.assigned_to_id = obj.assigned_to_id.toString();
    if (obj.created_by_id) obj.created_by_id = obj.created_by_id.toString();
    if (obj.approved_by_id) obj.approved_by_id = obj.approved_by_id.toString();
    if (obj.denied_by_id) obj.denied_by_id = obj.denied_by_id.toString();
    if (obj.removed_by_id) obj.removed_by_id = obj.removed_by_id.toString();
    if (obj.related_task_id) obj.related_task_id = obj.related_task_id.toString();
    delete obj._id;
    delete obj.__v;
    return obj;
}

export async function POST(request) {
    try {
        await dbConnect();
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { op } = body;
        const isAdmin = user.role === 'admin';

        switch (op) {
            case 'load': {
                await requireApproved(user);

                // Load tasks
                let tasks;
                if (isAdmin) {
                    tasks = await Task.find({}).sort({ deadline: -1 }).limit(500).lean();
                } else {
                    tasks = await Task.find({ assigned_to_id: user.id, deleted: { $ne: true } }).sort({ deadline: -1 }).limit(200).lean();
                }

                // Load notifications for this user
                const notifications = await Notification.find({ user_id: user.id })
                    .sort({ created_date: -1 })
                    .limit(100)
                    .lean();

                // Load leave requests
                let leaveRequests;
                if (isAdmin) {
                    leaveRequests = await LeaveRequest.find({}).sort({ created_date: -1 }).limit(100).lean();
                } else {
                    leaveRequests = await LeaveRequest.find({ user_id: user.id }).sort({ created_date: -1 }).limit(100).lean();
                }

                // Load users (approved employees) for admin dropdown
                let users = [];
                if (isAdmin) {
                    const accessRecords = await EmployeeAccess.find({ status: 'approved', user_id: { $ne: null } }).limit(500).lean();
                    users = accessRecords.map(a => ({
                        id: a.user_id.toString(),
                        email: a.email || '',
                        full_name: a.full_name || '',
                        role: 'user',
                    }));
                } else {
                    users = [{ id: user.id, email: user.email, full_name: user.full_name, role: user.role }];
                }

                return NextResponse.json({
                    tasks: tasks.map(t => {
                        t.id = t._id.toString();
                        if (t.assigned_to_id) t.assigned_to_id = t.assigned_to_id.toString();
                        if (t.created_by_id) t.created_by_id = t.created_by_id.toString();
                        delete t._id; delete t.__v;
                        return t;
                    }),
                    notifications: notifications.map(n => {
                        n.id = n._id.toString();
                        if (n.user_id) n.user_id = n.user_id.toString();
                        if (n.related_task_id) n.related_task_id = n.related_task_id.toString();
                        delete n._id; delete n.__v;
                        return n;
                    }),
                    leaveRequests: leaveRequests.map(l => {
                        l.id = l._id.toString();
                        if (l.user_id) l.user_id = l.user_id.toString();
                        delete l._id; delete l.__v;
                        return l;
                    }),
                    users,
                });
            }

            case 'createTask': {
                requireAdmin(user);
                const d = body.task || {};

                let assigneeName = '';
                if (d.assigned_to_id) {
                    const access = await EmployeeAccess.findOne({ user_id: d.assigned_to_id, status: 'approved' });
                    if (access) {
                        assigneeName = access.full_name || access.email || '';
                    }
                }

                const task = await Task.create({
                    title: d.title,
                    platform: d.platform,
                    content_type: d.content_type,
                    deadline: d.deadline,
                    assigned_to_id: d.assigned_to_id,
                    assigned_to_name: assigneeName,
                    status: 'pending',
                    google_drive_link: d.google_drive_link || '',
                    notes: d.notes || '',
                    created_by_id: user.id,
                });

                // Notify the assignee
                if (d.assigned_to_id) {
                    await Notification.create({
                        user_id: d.assigned_to_id,
                        type: 'task_assigned',
                        message: `New task assigned: "${d.title}"`,
                        related_task_id: task._id,
                        read: false,
                    });
                }

                return NextResponse.json({ task: toPlain(task) });
            }

            case 'completeTask': {
                await requireApproved(user);
                const task = body.task || {};
                await Task.findByIdAndUpdate(task.id, { status: 'completed' });

                // Notify admin
                if (task.created_by_id) {
                    await Notification.create({
                        user_id: task.created_by_id,
                        type: 'task_completed',
                        message: `${task.assigned_to_name || 'Employee'} completed "${task.title}"`,
                        related_task_id: task.id,
                        read: false,
                    });
                }

                return NextResponse.json({ ok: true });
            }

            case 'deleteTask': {
                requireAdmin(user);
                await Task.findByIdAndUpdate(body.taskId, { deleted: true });
                return NextResponse.json({ ok: true });
            }

            case 'updateTaskNotes': {
                requireAdmin(user);
                const { taskId, notes } = body;
                await Task.findByIdAndUpdate(taskId, { notes: notes || '' });
                return NextResponse.json({ ok: true });
            }

            case 'submitLeave': {
                await requireApproved(user);
                const d = body.leave || {};
                const requesterName = user.full_name || user.email || 'Employee';
                await LeaveRequest.create({
                    start_date: d.start_date,
                    end_date: d.end_date,
                    reason: d.reason,
                    user_id: user.id,
                    user_name: requesterName,
                    status: 'pending',
                });

                // Notify admins of the new leave request
                try {
                    const admins = await User.find({ role: 'admin' });
                    for (const adm of admins) {
                        await Notification.create({
                            user_id: adm._id,
                            type: 'leave_requested',
                            message: `Leave request from ${requesterName} (${d.start_date} to ${d.end_date})${d.reason ? `: "${d.reason}"` : ''}`,
                            read: false,
                        });
                    }
                } catch (notifErr) {
                    console.error('Failed to notify admins of leave request:', notifErr);
                }

                return NextResponse.json({ ok: true });
            }

            case 'respondLeave': {
                requireAdmin(user);
                const r = body.request || {};
                await LeaveRequest.findByIdAndUpdate(r.id, { status: body.status });
                await Notification.create({
                    user_id: r.user_id,
                    type: 'leave_status_update',
                    message: `Your leave request (${r.start_date} to ${r.end_date}) was ${body.status}`,
                    read: false,
                });
                return NextResponse.json({ ok: true });
            }

            case 'markNotificationsRead': {
                await requireApproved(user);
                const ids = body.ids || [];
                if (ids.length) {
                    await Notification.updateMany(
                        { _id: { $in: ids }, user_id: user.id },
                        { $set: { read: true } }
                    );
                }
                return NextResponse.json({ ok: true });
            }

            case 'deleteNotification': {
                await requireApproved(user);
                const { notificationId } = body;
                if (notificationId && mongoose.Types.ObjectId.isValid(String(notificationId))) {
                    await Notification.deleteOne({ _id: notificationId, user_id: user.id });
                }
                return NextResponse.json({ ok: true });
            }

            case 'clearNotifications': {
                await requireApproved(user);
                const ids = body.ids || [];
                if (ids.length) {
                    await Notification.deleteMany({ _id: { $in: ids }, user_id: user.id });
                } else {
                    await Notification.deleteMany({ user_id: user.id });
                }
                return NextResponse.json({ ok: true });
            }

            case 'removeEmployee': {
                requireAdmin(user);
                await EmployeeAccess.updateMany(
                    accessIdFilter(body.userId),
                    { $set: { status: 'removed', removed_at: new Date(), removed_by_id: user.id } }
                );
                return NextResponse.json({ ok: true });
            }

            case 'inviteEmployee': {
                requireAdmin(user);
                const { email } = body;
                if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });
                const existingUser = await User.findOne({ email: email.toLowerCase() });
                const access = await EmployeeAccess.findOne({ email: email.toLowerCase() });
                
                if (access) {
                    // Reinviting someone who was removed/denied: wipe the old login account
                    // so the invite link lets them register again with the same email.
                    let linkedUser = existingUser;
                    if (
                        existingUser &&
                        existingUser.role !== 'admin' &&
                        (access.status === 'removed' || access.status === 'denied')
                    ) {
                        await User.deleteOne({ _id: existingUser._id });
                        linkedUser = null;
                        access.user_id = null;
                    }
                    access.status = 'approved';
                    access.approved_at = new Date();
                    access.approved_by_id = user.id;
                    if (linkedUser) access.user_id = linkedUser._id;
                    await access.save();
                } else {
                    await EmployeeAccess.create({
                        email: email.toLowerCase(),
                        status: 'approved',
                        approved_at: new Date(),
                        approved_by_id: user.id,
                        user_id: existingUser ? existingUser._id : null,
                    });
                }
                
                const origin = request.headers.get('origin') || 'http://localhost:3000';
                const inviteLink = `${origin}/register?email=${encodeURIComponent(email.toLowerCase())}`;
                try {
                    await sendInviteEmail(email.toLowerCase(), inviteLink);
                } catch (mailError) {
                    console.error('Invite email failed:', mailError);
                    throw { status: 500, message: `Employee approved, but the invite email failed: ${mailError.message}` };
                }

                return NextResponse.json({ ok: true });
            }

            case 'deleteAccess': {
                requireAdmin(user);
                const records = await EmployeeAccess.find({
                    ...accessIdFilter(body.userId),
                    status: { $in: ['removed', 'denied'] },
                });
                if (!records.length) {
                    throw { status: 400, message: 'Only removed or denied employees can be deleted' };
                }
                for (const rec of records) {
                    // Delete the login account too (never an admin) so the email is free again.
                    await User.deleteOne({ email: rec.email, role: { $ne: 'admin' } });
                    await EmployeeAccess.deleteOne({ _id: rec._id });
                }
                return NextResponse.json({ ok: true });
            }

            case 'loadAccess': {
                requireAdmin(user);
                const records = await EmployeeAccess.find({}).limit(500).lean();
                const tasks = await Task.find({}).limit(1000).lean();

                const stats = {};
                for (const t of tasks) {
                    if (!t.assigned_to_id) continue;
                    const key = t.assigned_to_id.toString();
                    stats[key] = stats[key] || { pending: 0, completed: 0 };
                    if (t.status === 'completed') stats[key].completed++;
                    else stats[key].pending++;
                }

                const rows = records.map(a => ({
                    id: a._id.toString(),
                    user_id: a.user_id ? a.user_id.toString() : null,
                    email: a.email || '',
                    full_name: a.full_name || '',
                    status: a.status,
                    requested_at: a.requested_at,
                    approved_at: a.approved_at,
                    denied_at: a.denied_at,
                    removed_at: a.removed_at,
                    denial_reason: a.denial_reason || '',
                    tasks: a.user_id ? (stats[a.user_id.toString()] || { pending: 0, completed: 0 }) : { pending: 0, completed: 0 },
                }));

                return NextResponse.json({ rows });
            }

            case 'approve': {
                requireAdmin(user);
                await EmployeeAccess.updateMany(
                    accessIdFilter(body.userId),
                    { $set: { status: 'approved', approved_at: new Date(), approved_by_id: user.id } }
                );
                return NextResponse.json({ ok: true });
            }

            case 'deny': {
                requireAdmin(user);
                await EmployeeAccess.updateMany(
                    accessIdFilter(body.userId),
                    { $set: { status: 'denied', denied_at: new Date(), denied_by_id: user.id, denial_reason: body.reason || '' } }
                );
                return NextResponse.json({ ok: true });
            }

            case 'loadChatSummary': {
                await requireApproved(user);
                const uid = new mongoose.Types.ObjectId(String(user.id));

                // Build the list of conversations this user can see.
                let conversations;
                if (isAdmin) {
                    const employees = await EmployeeAccess.find({ status: 'approved', user_id: { $ne: null } }).limit(500).lean();
                    conversations = [
                        { id: 'team', type: 'team', title: 'Team Chat' },
                        ...employees.map((a) => ({
                            id: `dm:${a.user_id.toString()}`,
                            type: 'dm',
                            title: a.full_name || a.email || 'Employee',
                            subtitle: a.email || '',
                        })),
                    ];
                } else {
                    conversations = [
                        { id: `dm:${user.id}`, type: 'dm', title: 'Admin', subtitle: 'Private chat with admin' },
                        { id: 'team', type: 'team', title: 'Team Chat' },
                    ];
                }

                const ids = conversations.map((c) => c.id);
                const stats = await Message.aggregate([
                    { $match: { conversation_id: { $in: ids } } },
                    { $sort: { created_date: -1 } },
                    {
                        $group: {
                            _id: '$conversation_id',
                            last: { $first: '$$ROOT' },
                            unread: {
                                $sum: {
                                    $cond: [
                                        {
                                            $and: [
                                                { $ne: ['$sender_id', uid] },
                                                { $not: [{ $in: [uid, { $ifNull: ['$read_by', []] }] }] },
                                            ],
                                        },
                                        1,
                                        0,
                                    ],
                                },
                            },
                        },
                    },
                ]);
                const byId = Object.fromEntries(stats.map((s) => [s._id, s]));

                const result = conversations.map((c) => {
                    const s = byId[c.id];
                    return {
                        ...c,
                        unread: s ? s.unread : 0,
                        last_message: s ? toPlainMessage(s.last, user.id) : null,
                    };
                });
                const unreadTotal = result.reduce((sum, c) => sum + c.unread, 0);

                return NextResponse.json({ conversations: result, unreadTotal });
            }

            case 'loadMessages': {
                await requireApproved(user);
                const { conversationId } = body;
                requireConversationAccess(user, conversationId);

                const messages = await Message.find({ conversation_id: conversationId })
                    .sort({ created_date: -1 })
                    .limit(200)
                    .lean();

                // Opening a conversation marks everything in it as read for this user.
                await Message.updateMany(
                    { conversation_id: conversationId, sender_id: { $ne: user.id }, read_by: { $ne: user.id } },
                    { $addToSet: { read_by: user.id } }
                );

                return NextResponse.json({
                    messages: messages.reverse().map((m) => toPlainMessage(m, user.id)),
                });
            }

            case 'sendMessage': {
                await requireApproved(user);
                const { conversationId } = body;
                requireConversationAccess(user, conversationId);
                const text = String(body.text || '').trim();
                if (!text) throw { status: 400, message: 'Message cannot be empty' };
                if (text.length > 4000) throw { status: 400, message: 'Message is too long' };

                const msg = await Message.create({
                    conversation_id: conversationId,
                    sender_id: user.id,
                    sender_name: user.full_name || user.email || '',
                    sender_role: user.role || 'user',
                    text,
                    read_by: [user.id],
                });

                return NextResponse.json({ message: toPlainMessage(msg, user.id) });
            }

            default:
                return NextResponse.json({ error: 'Unknown op' }, { status: 400 });
        }
    } catch (error) {
        const status = error.status || 500;
        if (status >= 500) console.error('Studio API error:', error);
        const message = error.message || 'Internal server error';
        return NextResponse.json({ error: message }, { status });
    }
}
