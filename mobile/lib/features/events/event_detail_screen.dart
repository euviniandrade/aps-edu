import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class EventDetailScreen extends StatefulWidget {
  final String eventId;
  const EventDetailScreen({super.key, required this.eventId});
  @override
  State<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends State<EventDetailScreen> {
  Map<String, dynamic>? _event;
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await api.getEvent(widget.eventId);
      setState(() { _event = res.data; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }

  Future<void> _completeTimeline(String itemId, bool isDone) async {
    await api.updateTimeline(widget.eventId, itemId, {'completedAt': isDone ? null : DateTime.now().toIso8601String()});
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppColors.primary)));
    if (_event == null) return const Scaffold(body: Center(child: Text('Evento não encontrado')));

    final timeline = List<Map<String, dynamic>>.from(_event!['timeline'] ?? []);
    final responsibles = List<Map<String, dynamic>>.from(_event!['responsibles'] ?? []);
    final photos = List<Map<String, dynamic>>.from(_event!['photos'] ?? []);
    final progress = _event!['progressPercent'] ?? 0;

    return Scaffold(
      appBar: AppBar(title: Text(_event!['name'] ?? 'Evento')),
      body: ListView(
        children: [
          // Capa
          Container(
            height: 160,
            color: AppColors.primary.withOpacity(0.15),
            child: const Center(child: Icon(Icons.event_rounded, size: 72, color: AppColors.primary)),
          ),

          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_event!['name'] ?? '', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Row(children: [
                  const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text(_event!['location'] ?? '', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                ]),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: LinearProgressIndicator(value: progress / 100, minHeight: 8, backgroundColor: AppColors.border, valueColor: const AlwaysStoppedAnimation(AppColors.primary))),
                  const SizedBox(width: 10),
                  Text('$progress%', style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 14)),
                ]),
                const SizedBox(height: 4),
                const Text('executado', style: TextStyle(color: AppColors.textSecondary, fontSize: 11)),

                const SizedBox(height: 20),
                const Text('Responsáveis', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: responsibles.map((r) => Chip(
                    avatar: CircleAvatar(child: Text((r['user']?['name'] ?? 'U')[0], style: const TextStyle(fontSize: 12))),
                    label: Text(r['user']?['name'] ?? '', style: const TextStyle(fontSize: 12)),
                  )).toList(),
                ),

                const SizedBox(height: 20),
                Text('Linha do Tempo (${timeline.where((t) => t['completedAt'] != null).length}/${timeline.length})', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                ...timeline.asMap().entries.map((entry) {
                  final i = entry.key;
                  final item = entry.value;
                  final done = item['completedAt'] != null;
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Column(children: [
                        Container(width: 28, height: 28,
                          decoration: BoxDecoration(
                            color: done ? AppColors.success : AppColors.border,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(done ? Icons.check : Icons.radio_button_unchecked, color: done ? Colors.white : AppColors.textSecondary, size: 16),
                        ),
                        if (i < timeline.length - 1)
                          Container(width: 2, height: 40, color: done ? AppColors.success.withOpacity(0.4) : AppColors.border),
                      ]),
                      const SizedBox(width: 12),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => _completeTimeline(item['id'], done),
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: done ? AppColors.success.withOpacity(0.08) : Colors.white,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: done ? AppColors.success.withOpacity(0.3) : AppColors.border),
                            ),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(item['title'] ?? '', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, decoration: done ? TextDecoration.lineThrough : null)),
                              if (item['description'] != null)
                                Text(item['description'], style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                            ]),
                          ),
                        ),
                      ),
                    ],
                  );
                }),

                if (photos.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  Text('Fotos (${photos.length})', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 90,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: photos.length,
                      itemBuilder: (_, i) => Container(
                        width: 90, height: 90,
                        margin: const EdgeInsets.only(right: 8),
                        decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(8)),
                        child: const Icon(Icons.photo, color: AppColors.textSecondary),
                      ),
                    ),
                  ),
                ],

                const SizedBox(height: 24),
                OutlinedButton.icon(
                  icon: const Icon(Icons.assessment_outlined),
                  label: const Text('Gerar Relatório Final'),
                  onPressed: () {},
                  style: OutlinedButton.styleFrom(foregroundColor: AppColors.primary),
                ),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
