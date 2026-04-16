import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});
  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  List<dynamic> _announcements = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await api.getAnnouncements();
      setState(() { _announcements = res.data ?? []; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }

  Color _typeColor(String? t) {
    switch (t) {
      case 'urgent': return AppColors.danger;
      case 'warning': return AppColors.warning;
      case 'celebration': return AppColors.gold;
      default: return AppColors.navy;
    }
  }

  IconData _typeIcon(String? t) {
    switch (t) {
      case 'urgent': return Icons.warning_rounded;
      case 'warning': return Icons.info_rounded;
      case 'celebration': return Icons.celebration_rounded;
      default: return Icons.campaign_rounded;
    }
  }

  String _typeLabel(String? t) {
    switch (t) {
      case 'urgent': return '🚨 URGENTE';
      case 'warning': return '⚠️ ATENÇÃO';
      case 'celebration': return '🎉 CELEBRAÇÃO';
      default: return '📋 INFORMATIVO';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mural de Avisos')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/announcements/new').then((_) => _load()),
        backgroundColor: AppColors.navy,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Novo Aviso', style: TextStyle(color: Colors.white)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.navy))
          : _announcements.isEmpty
              ? const Center(child: Text('Nenhum aviso no momento', style: TextStyle(color: AppColors.textSecondary)))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _announcements.length,
                    itemBuilder: (_, i) {
                      final a = _announcements[i];
                      final color = _typeColor(a['type']);
                      final isRead = a['isRead'] == true;
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () async {
                            if (!isRead) {
                              await api.readAnnouncement(a['id']);
                              _load();
                            }
                            if (mounted) {
                              showDialog(context: context, builder: (_) => AlertDialog(
                                title: Text(a['title'] ?? ''),
                                content: Text(a['content'] ?? ''),
                                actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Fechar'))],
                              ));
                            }
                          },
                          child: Container(
                            decoration: BoxDecoration(
                              border: Border(left: BorderSide(color: color, width: 4)),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
                                    child: Text(_typeLabel(a['type']), style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
                                  ),
                                  const Spacer(),
                                  if (!isRead)
                                    Container(
                                      width: 8, height: 8,
                                      decoration: const BoxDecoration(color: AppColors.navy, shape: BoxShape.circle),
                                    ),
                                ]),
                                const SizedBox(height: 8),
                                Text(a['title'] ?? '', style: TextStyle(fontWeight: isRead ? FontWeight.w500 : FontWeight.bold, fontSize: 15)),
                                const SizedBox(height: 4),
                                Text((a['content'] ?? '').toString().length > 100 ? '${a['content'].toString().substring(0, 100)}...' : a['content'] ?? '',
                                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                                const SizedBox(height: 8),
                                Row(children: [
                                  const Icon(Icons.person_outline, size: 12, color: AppColors.textSecondary),
                                  const SizedBox(width: 4),
                                  Text(a['author']?['name'] ?? '', style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                                  const Spacer(),
                                  if (isRead)
                                    const Row(children: [
                                      Icon(Icons.check_circle, size: 14, color: AppColors.success),
                                      SizedBox(width: 4),
                                      Text('Lido', style: TextStyle(color: AppColors.success, fontSize: 11)),
                                    ])
                                  else
                                    const Text('Toque para confirmar leitura', style: TextStyle(color: AppColors.navy, fontSize: 11)),
                                ]),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
