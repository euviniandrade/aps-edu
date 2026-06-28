import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:dio/dio.dart';
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
  bool _uploadingPhoto = false;
  bool _loadingReport = false;

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

  Future<void> _addPhoto() async {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            const Text('Adicionar foto', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ListTile(
              leading: const CircleAvatar(backgroundColor: AppColors.navy, child: Icon(Icons.camera_alt, color: Colors.white)),
              title: const Text('Tirar foto'),
              onTap: () { Navigator.pop(context); _pickPhoto(ImageSource.camera); },
            ),
            ListTile(
              leading: const CircleAvatar(backgroundColor: AppColors.info, child: Icon(Icons.photo_library, color: Colors.white)),
              title: const Text('Escolher da galeria'),
              onTap: () { Navigator.pop(context); _pickPhoto(ImageSource.gallery); },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Future<void> _pickPhoto(ImageSource source) async {
    try {
      final picker = ImagePicker();
      final XFile? image = await picker.pickImage(source: source, imageQuality: 85, maxWidth: 1920);
      if (image == null) return;

      setState(() => _uploadingPhoto = true);
      final formData = FormData.fromMap({
        'photo': await MultipartFile.fromFile(image.path, filename: image.name),
      });
      await api.uploadEventPhoto(widget.eventId, formData);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Foto adicionada!'), backgroundColor: AppColors.success),
        );
        _load();
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Erro ao enviar foto'), backgroundColor: AppColors.danger),
      );
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  Future<void> _generateReport() async {
    setState(() => _loadingReport = true);
    try {
      final res = await api.getEventReport(widget.eventId);
      if (!mounted) return;
      final report = res.data as Map<String, dynamic>;
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: Text('Relatório: ${report['event']?['name'] ?? ''}'),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                _reportLine('Progresso', '${report['event']?['progressPercent'] ?? 0}%'),
                _reportLine('Status', report['event']?['status'] ?? ''),
                _reportLine('Local', report['event']?['location'] ?? ''),
                const Divider(),
                _reportLine('Tarefas no prazo', '${report['stats']?['tasksOnTime'] ?? 0}'),
                _reportLine('Tarefas atrasadas', '${report['stats']?['tasksLate'] ?? 0}'),
                _reportLine('Total responsáveis', '${report['stats']?['totalResponsibles'] ?? 0}'),
                _reportLine('Fotos', '${report['stats']?['totalPhotos'] ?? 0}'),
                const Divider(),
                const Text('Linha do tempo:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 4),
                ...(report['timeline'] as List? ?? []).map((t) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(children: [
                    Icon(t['completedAt'] != null ? Icons.check_circle : Icons.radio_button_unchecked,
                        size: 14, color: t['completedAt'] != null ? AppColors.success : AppColors.textSecondary),
                    const SizedBox(width: 6),
                    Expanded(child: Text(t['title'] ?? '', style: const TextStyle(fontSize: 12))),
                  ]),
                )),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Fechar')),
          ],
        ),
      );
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Erro ao gerar relatório'), backgroundColor: AppColors.danger),
      );
    } finally {
      if (mounted) setState(() => _loadingReport = false);
    }
  }

  Widget _reportLine(String label, String value) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Row(children: [
      Text('$label: ', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
      Text(value, style: const TextStyle(fontSize: 13)),
    ]),
  );

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppColors.navy)));
    if (_event == null) return const Scaffold(body: Center(child: Text('Evento não encontrado')));

    final timeline = List<Map<String, dynamic>>.from(_event!['timeline'] ?? []);
    final responsibles = List<Map<String, dynamic>>.from(_event!['responsibles'] ?? []);
    final photos = List<Map<String, dynamic>>.from(_event!['photos'] ?? []);
    final progress = _event!['progressPercent'] ?? 0;
    final doneCount = timeline.where((t) => t['completedAt'] != null).length;

    return Scaffold(
      appBar: AppBar(title: Text(_event!['name'] ?? 'Evento')),
      body: ListView(
        children: [
          // Capa
          Container(
            height: 160,
            color: AppColors.navy.withOpacity(0.15),
            child: const Center(child: Icon(Icons.event_rounded, size: 72, color: AppColors.navy)),
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
                  Expanded(child: Text(_event!['location'] ?? '', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13))),
                ]),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: LinearProgressIndicator(value: progress / 100, minHeight: 8, backgroundColor: AppColors.border, valueColor: const AlwaysStoppedAnimation(AppColors.navy))),
                  const SizedBox(width: 10),
                  Text('$progress%', style: const TextStyle(color: AppColors.navy, fontWeight: FontWeight.bold, fontSize: 14)),
                ]),
                const SizedBox(height: 4),
                const Text('executado', style: TextStyle(color: AppColors.textSecondary, fontSize: 11)),

                const SizedBox(height: 20),
                const Text('Responsáveis', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: responsibles.map((r) => Chip(
                    avatar: CircleAvatar(
                      backgroundColor: AppColors.navy.withOpacity(0.2),
                      child: Text((r['user']?['name'] ?? 'U')[0], style: const TextStyle(fontSize: 12, color: AppColors.navy)),
                    ),
                    label: Text(r['user']?['name'] ?? '', style: const TextStyle(fontSize: 12)),
                  )).toList(),
                ),

                const SizedBox(height: 20),
                Text('Linha do Tempo ($doneCount/${timeline.length})', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                ...timeline.asMap().entries.map((entry) {
                  final i = entry.key;
                  final item = entry.value;
                  final done = item['completedAt'] != null;
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Column(children: [
                        Container(
                          width: 28, height: 28,
                          decoration: BoxDecoration(
                            color: done ? AppColors.success : AppColors.border,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(done ? Icons.check : Icons.radio_button_unchecked, color: done ? Colors.white : AppColors.textSecondary, size: 16),
                        ),
                        if (i < timeline.length - 1)
                          Container(width: 2, height: 44, color: done ? AppColors.success.withOpacity(0.4) : AppColors.border),
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
                              if (item['description'] != null && (item['description'] as String).isNotEmpty)
                                Text(item['description'], style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                            ]),
                          ),
                        ),
                      ),
                    ],
                  );
                }),

                const SizedBox(height: 20),
                Row(children: [
                  Text('Fotos (${photos.length})', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                  const Spacer(),
                  if (_uploadingPhoto)
                    const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.navy))
                  else
                    TextButton.icon(
                      icon: const Icon(Icons.add_a_photo, size: 16),
                      label: const Text('Adicionar'),
                      onPressed: _addPhoto,
                      style: TextButton.styleFrom(foregroundColor: AppColors.navy, padding: EdgeInsets.zero),
                    ),
                ]),
                const SizedBox(height: 8),
                if (photos.isEmpty)
                  const Center(child: Text('Nenhuma foto ainda', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)))
                else
                  SizedBox(
                    height: 90,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: photos.length,
                      itemBuilder: (_, i) => Container(
                        width: 90, height: 90,
                        margin: const EdgeInsets.only(right: 8),
                        decoration: BoxDecoration(color: AppColors.navy.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                        child: const Icon(Icons.photo, color: AppColors.navy),
                      ),
                    ),
                  ),

                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    icon: _loadingReport
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.assessment_outlined),
                    label: Text(_loadingReport ? 'Gerando...' : 'Gerar Relatório Final'),
                    onPressed: _loadingReport ? null : _generateReport,
                    style: OutlinedButton.styleFrom(foregroundColor: AppColors.navy, padding: const EdgeInsets.symmetric(vertical: 14)),
                  ),
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
