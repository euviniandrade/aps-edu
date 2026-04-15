import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/task_card.dart';

class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});
  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  List<dynamic> _tasks = [];
  bool _loading = true;
  String _statusFilter = 'all';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final params = _statusFilter != 'all' ? {'status': _statusFilter} : null;
      final res = await api.getTasks(params: params);
      setState(() { _tasks = res.data['tasks'] ?? []; _loading = false; });
    } catch (_) { setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tarefas')),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: ['all', 'pending', 'in_progress', 'completed', 'overdue'].map((s) {
                const labels = {'all': 'Todas', 'pending': 'Pendentes', 'in_progress': 'Em andamento', 'completed': 'Concluídas', 'overdue': 'Atrasadas'};
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(labels[s]!),
                    selected: _statusFilter == s,
                    onSelected: (_) { setState(() => _statusFilter = s); _load(); },
                    selectedColor: AppColors.primary.withOpacity(0.15),
                    checkmarkColor: AppColors.primary,
                  ),
                );
              }).toList(),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _tasks.isEmpty
                    ? const Center(child: Text('Nenhuma tarefa encontrada', style: TextStyle(color: AppColors.textSecondary)))
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: _tasks.length,
                          itemBuilder: (_, i) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: TaskCard(task: _tasks[i], onTap: () => context.push('/tasks/${_tasks[i]['id']}')),
                          ),
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
