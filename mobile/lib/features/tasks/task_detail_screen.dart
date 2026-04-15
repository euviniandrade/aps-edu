import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class TaskDetailScreen extends StatefulWidget {
  final String taskId;
  const TaskDetailScreen({super.key, required this.taskId});
  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  Map<String, dynamic>? _task;
  bool _loading = true;
  final _commentCtrl = TextEditingController();

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await api.getTask(widget.taskId);
      setState(() { _task = res.data; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }

  Future<void> _toggleChecklist(String checkId, bool current) async {
    await api.updateChecklist(widget.taskId, checkId, {'isCompleted': !current});
    _load();
  }

  Future<void> _sendComment() async {
    final text = _commentCtrl.text.trim();
    if (text.isEmpty) return;
    await api.addComment(widget.taskId, text);
    _commentCtrl.clear();
    _load();
  }

  Future<void> _markComplete() async {
    await api.updateTask(widget.taskId, {'status': 'completed', 'progressPercent': 100});
    _load();
  }

  Color get _statusColor {
    switch (_task?['status']) {
      case 'completed': return AppColors.success;
      case 'in_progress': return AppColors.warning;
      case 'overdue': return AppColors.danger;
      default: return AppColors.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppColors.primary)));
    if (_task == null) return const Scaffold(body: Center(child: Text('Tarefa não encontrada')));

    final checklists = List<Map<String, dynamic>>.from(_task!['checklists'] ?? []);
    final comments = List<Map<String, dynamic>>.from(_task!['comments'] ?? []);
    final evidences = List<Map<String, dynamic>>.from(_task!['evidences'] ?? []);
    final progress = _task!['progressPercent'] ?? 0;
    final isCompleted = _task!['status'] == 'completed';

    return Scaffold(
      appBar: AppBar(title: const Text('Detalhe da Tarefa')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(child: Text(_task!['title'], style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(color: _statusColor.withOpacity(0.15), borderRadius: BorderRadius.circular(20)),
                      child: Text(_task!['status'] ?? '', style: TextStyle(color: _statusColor, fontSize: 12, fontWeight: FontWeight.w600)),
                    ),
                  ]),
                  if (_task!['description'] != null) ...[
                    const SizedBox(height: 8),
                    Text(_task!['description'], style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
                  ],
                  const SizedBox(height: 16),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: LinearProgressIndicator(value: progress / 100, minHeight: 8, backgroundColor: AppColors.border, valueColor: AlwaysStoppedAnimation(_statusColor)),
                  ),
                  const SizedBox(height: 4),
                  Text('$progress% concluído', style: TextStyle(color: _statusColor, fontSize: 12, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 12),
                  if (_task!['assignedTo'] != null) _infoRow(Icons.person_outline, 'Responsável: ${_task!['assignedTo']['name']}'),
                  if (_task!['dueDate'] != null) _infoRow(Icons.calendar_today_outlined, 'Vence: ${_formatDate(_task!['dueDate'])}'),
                  _infoRow(Icons.flag_outlined, 'Prioridade: ${_task!['priority'] ?? ''}'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Checklist
          if (checklists.isNotEmpty) ...[
            _sectionTitle('Checklist (${checklists.where((c) => c['isCompleted'] == true).length}/${checklists.length})'),
            Card(
              child: Column(
                children: checklists.map((item) => CheckboxListTile(
                  dense: true,
                  value: item['isCompleted'] ?? false,
                  activeColor: AppColors.primary,
                  title: Text(item['title'] ?? '', style: TextStyle(decoration: item['isCompleted'] == true ? TextDecoration.lineThrough : null, fontSize: 14)),
                  onChanged: (_) => _toggleChecklist(item['id'], item['isCompleted'] ?? false),
                )).toList(),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Evidências
          _sectionTitle('Evidências (${evidences.length})'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                children: [
                  ...evidences.map((e) => ListTile(
                    dense: true,
                    leading: Icon(e['fileType'] == 'image' ? Icons.image : Icons.description, color: AppColors.primary),
                    title: Text(e['fileName'] ?? '', style: const TextStyle(fontSize: 13)),
                    subtitle: Text(e['user']?['name'] ?? '', style: const TextStyle(fontSize: 11)),
                  )),
                  TextButton.icon(
                    icon: const Icon(Icons.attach_file),
                    label: const Text('Adicionar evidência'),
                    onPressed: () {},
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Comentários
          _sectionTitle('Comentários (${comments.length})'),
          Card(
            child: Column(
              children: [
                ...comments.map((c) => ListTile(
                  dense: true,
                  leading: CircleAvatar(radius: 16, backgroundColor: AppColors.primary.withOpacity(0.15), child: Text((c['user']?['name'] ?? 'U')[0], style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold))),
                  title: Text(c['user']?['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  subtitle: Text(c['content'] ?? '', style: const TextStyle(fontSize: 13)),
                )),
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(children: [
                    Expanded(child: TextField(controller: _commentCtrl, decoration: const InputDecoration(hintText: 'Escrever comentário...', isDense: true))),
                    IconButton(icon: const Icon(Icons.send, color: AppColors.primary), onPressed: _sendComment),
                  ]),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          if (!isCompleted)
            ElevatedButton.icon(
              icon: const Icon(Icons.check_circle),
              label: const Text('Marcar como Concluída'),
              onPressed: _markComplete,
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
            ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _sectionTitle(String title) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
  );

  Widget _infoRow(IconData icon, String text) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Row(children: [
      Icon(icon, size: 14, color: AppColors.textSecondary),
      const SizedBox(width: 6),
      Text(text, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
    ]),
  );

  String _formatDate(String? date) {
    if (date == null) return '';
    try { final d = DateTime.parse(date); return '${d.day.toString().padLeft(2,'0')}/${d.month.toString().padLeft(2,'0')}/${d.year}'; } catch (_) { return ''; }
  }
}
