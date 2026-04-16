import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> _notifications = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await api.getNotifications();
      setState(() { _notifications = res.data['notifications'] ?? []; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }

  Future<void> _markAllRead() async {
    await api.markAllNotificationsRead();
    _load();
  }

  IconData _typeIcon(String? t) {
    switch (t) {
      case 'badge': return Icons.military_tech_rounded;
      case 'event': return Icons.event_rounded;
      case 'announcement': return Icons.campaign_rounded;
      case 'reminder': return Icons.alarm_rounded;
      default: return Icons.check_circle_rounded;
    }
  }

  Color _typeColor(String? t) {
    switch (t) {
      case 'badge': return AppColors.gold;
      case 'event': return AppColors.navy;
      case 'announcement': return AppColors.warning;
      case 'reminder': return AppColors.danger;
      default: return AppColors.success;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificações'),
        actions: [
          TextButton(onPressed: _markAllRead, child: const Text('Marcar todas lidas', style: TextStyle(color: Colors.white, fontSize: 12))),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.navy))
          : _notifications.isEmpty
              ? const Center(child: Text('Nenhuma notificação', style: TextStyle(color: AppColors.textSecondary)))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    itemCount: _notifications.length,
                    itemBuilder: (_, i) {
                      final n = _notifications[i];
                      final isRead = n['isRead'] == true;
                      final color = _typeColor(n['type']);
                      return InkWell(
                        onTap: () async {
                          if (!isRead) { await api.markNotificationRead(n['id']); _load(); }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            color: isRead ? Colors.transparent : AppColors.navy.withOpacity(0.04),
                            border: Border(bottom: BorderSide(color: AppColors.border)),
                          ),
                          child: Row(children: [
                            Container(width: 42, height: 42,
                              decoration: BoxDecoration(color: color.withOpacity(0.12), shape: BoxShape.circle),
                              child: Icon(_typeIcon(n['type']), color: color, size: 20),
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(n['title'] ?? '', style: TextStyle(fontWeight: isRead ? FontWeight.normal : FontWeight.bold, fontSize: 14)),
                              Text(n['body'] ?? '', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12), maxLines: 2, overflow: TextOverflow.ellipsis),
                            ])),
                            if (!isRead) Container(width: 8, height: 8, decoration: const BoxDecoration(color: AppColors.navy, shape: BoxShape.circle)),
                          ]),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
