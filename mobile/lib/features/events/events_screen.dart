import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class EventsScreen extends StatefulWidget {
  const EventsScreen({super.key});
  @override
  State<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends State<EventsScreen> {
  List<dynamic> _events = [];
  bool _loading = true;
  String _filter = 'all';

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final params = _filter != 'all' ? {'status': _filter} : null;
      final res = await api.getEvents(params: params);
      setState(() { _events = res.data['events'] ?? []; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }

  Color _statusColor(String? s) {
    switch (s) {
      case 'ongoing': return AppColors.success;
      case 'completed': return AppColors.textSecondary;
      case 'cancelled': return AppColors.danger;
      default: return AppColors.primary;
    }
  }

  String _statusLabel(String? s) {
    switch (s) {
      case 'planned': return 'Planejado';
      case 'ongoing': return 'Em andamento';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      default: return s ?? '';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Eventos')),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: ['all', 'planned', 'ongoing', 'completed'].map((s) {
                const labels = {'all': 'Todos', 'planned': 'Planejados', 'ongoing': 'Em andamento', 'completed': 'Concluídos'};
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(labels[s]!),
                    selected: _filter == s,
                    onSelected: (_) { setState(() => _filter = s); _load(); },
                    selectedColor: AppColors.primary.withOpacity(0.15),
                  ),
                );
              }).toList(),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _events.isEmpty
                    ? const Center(child: Text('Nenhum evento encontrado', style: TextStyle(color: AppColors.textSecondary)))
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: _events.length,
                          itemBuilder: (_, i) {
                            final event = _events[i];
                            final progress = event['progressPercent'] ?? 0;
                            final color = _statusColor(event['status']);
                            return Card(
                              margin: const EdgeInsets.only(bottom: 12),
                              child: InkWell(
                                onTap: () => context.push('/events/${event['id']}'),
                                borderRadius: BorderRadius.circular(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      height: 100,
                                      decoration: BoxDecoration(
                                        color: color.withOpacity(0.15),
                                        borderRadius: const BorderRadius.only(topLeft: Radius.circular(12), topRight: Radius.circular(12)),
                                      ),
                                      child: Center(child: Icon(Icons.event_rounded, size: 48, color: color)),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.all(14),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Row(children: [
                                            Expanded(child: Text(event['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15))),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                              decoration: BoxDecoration(color: color.withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                                              child: Text(_statusLabel(event['status']), style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
                                            ),
                                          ]),
                                          const SizedBox(height: 6),
                                          Row(children: [
                                            const Icon(Icons.location_on_outlined, size: 13, color: AppColors.textSecondary),
                                            const SizedBox(width: 4),
                                            Expanded(child: Text(event['location'] ?? '', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12))),
                                          ]),
                                          const SizedBox(height: 10),
                                          Row(children: [
                                            Expanded(child: LinearProgressIndicator(value: progress / 100, minHeight: 6, backgroundColor: AppColors.border, valueColor: AlwaysStoppedAnimation(color))),
                                            const SizedBox(width: 8),
                                            Text('$progress%', style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
                                          ]),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
