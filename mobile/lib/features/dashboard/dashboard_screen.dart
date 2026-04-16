import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/stat_card.dart';
import '../../shared/widgets/task_card.dart';
import '../../shared/widgets/section_header.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});
  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  Map<String, dynamic>? _user;
  Map<String, dynamic>? _stats;
  List<dynamic> _myTasks = [];
  List<dynamic> _ranking = [];
  List<dynamic> _events = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([
        api.getMe(),
        api.getTasks(params: {'limit': '5', 'assignedTo': Hive.box('auth').get('user')?['id'] ?? ''}),
        api.getRanking(scope: 'weekly'),
        api.getEvents(params: {'limit': '3', 'status': 'planned'}),
      ]);
      setState(() {
        _user = results[0].data;
        _myTasks = results[1].data['tasks'] ?? [];
        _ranking = results[2].data['ranking'] ?? [];
        _events = results[3].data['events'] ?? [];
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'completed': return AppColors.success;
      case 'in_progress': return AppColors.warning;
      case 'overdue': return AppColors.danger;
      default: return AppColors.textSecondary;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'completed': return 'Concluída';
      case 'in_progress': return 'Em andamento';
      case 'overdue': return 'Atrasada';
      default: return 'Pendente';
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = _user;
    final firstName = user?['name']?.split(' ')?.first ?? 'Usuário';

    return Scaffold(
      backgroundColor: AppColors.background,
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.navy))
          : RefreshIndicator(
              onRefresh: _loadData,
              child: CustomScrollView(
                slivers: [
                  // App Bar
                  SliverAppBar(
                    expandedHeight: 140,
                    pinned: true,
                    backgroundColor: AppColors.navy,
                    flexibleSpace: FlexibleSpaceBar(
                      background: Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [AppColors.navy, AppColors.navyDark],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        padding: const EdgeInsets.fromLTRB(20, 60, 20, 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            Text('Bom dia, $firstName! 👋',
                                style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text('${user?['role']?['name'] ?? ''} | ${user?['unit']?['name'] ?? ''}',
                                style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13)),
                          ],
                        ),
                      ),
                    ),
                    actions: [
                      Stack(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.notifications_rounded, color: Colors.white),
                            onPressed: () => context.push('/notifications'),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.search_rounded, color: Colors.white),
                        onPressed: () => context.go('/tasks'),
                      ),
                    ],
                  ),

                  SliverPadding(
                    padding: const EdgeInsets.all(16),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
                        // Stats
                        Row(
                          children: [
                            Expanded(child: StatCard(label: 'Tarefas Ativas', value: _myTasks.length.toString(), icon: Icons.check_circle_outline, color: AppColors.navy)),
                            const SizedBox(width: 12),
                            Expanded(child: StatCard(label: 'Próx. Eventos', value: _events.length.toString(), icon: Icons.event_rounded, color: AppColors.accent)),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(child: StatCard(label: 'Meus Pontos', value: '${user?['points'] ?? 0}', icon: Icons.star_rounded, color: AppColors.gold)),
                            const SizedBox(width: 12),
                            Expanded(child: StatCard(label: 'Nível Atual', value: user?['level']?['name'] ?? 'Iniciante', icon: Icons.trending_up_rounded, color: AppColors.success)),
                          ],
                        ),
                        const SizedBox(height: 24),

                        // Minhas Tarefas
                        SectionHeader(title: 'Minhas Tarefas', onSeeAll: () => context.go('/tasks')),
                        const SizedBox(height: 12),
                        if (_myTasks.isEmpty)
                          _emptyState('Nenhuma tarefa atribuída', Icons.check_circle_rounded)
                        else
                          ..._myTasks.map((task) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: TaskCard(task: task, onTap: () => context.push('/tasks/${task['id']}')),
                          )),

                        const SizedBox(height: 24),

                        // Próximos Eventos
                        SectionHeader(title: 'Próximos Eventos', onSeeAll: () => context.go('/events')),
                        const SizedBox(height: 12),
                        if (_events.isEmpty)
                          _emptyState('Nenhum evento próximo', Icons.event_rounded)
                        else
                          ..._events.map((event) => _EventTile(event: event)),

                        const SizedBox(height: 24),

                        // Ranking
                        SectionHeader(title: 'Ranking da Semana 🏆', onSeeAll: () => context.push('/ranking')),
                        const SizedBox(height: 12),
                        Card(
                          child: Column(
                            children: _ranking.take(3).toList().asMap().entries.map((entry) {
                              final pos = entry.key;
                              final item = entry.value;
                              final medals = ['🥇', '🥈', '🥉'];
                              return ListTile(
                                leading: Text(medals[pos], style: const TextStyle(fontSize: 24)),
                                title: Text(item['user']?['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                                subtitle: Text(item['user']?['unit']?['name'] ?? '', style: const TextStyle(fontSize: 12)),
                                trailing: Text('${item['points']} pts', style: const TextStyle(color: AppColors.navy, fontWeight: FontWeight.bold)),
                              );
                            }).toList(),
                          ),
                        ),

                        const SizedBox(height: 80),
                      ]),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _emptyState(String text, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: AppColors.textSecondary, size: 20),
          const SizedBox(width: 8),
          Text(text, style: const TextStyle(color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}

class _EventTile extends StatelessWidget {
  final Map<String, dynamic> event;
  const _EventTile({required this.event});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          width: 44, height: 44,
          decoration: BoxDecoration(color: AppColors.navy.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
          child: const Icon(Icons.event_rounded, color: AppColors.navy),
        ),
        title: Text(event['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        subtitle: Text('📍 ${event['location'] ?? ''}', style: const TextStyle(fontSize: 12)),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('${event['progressPercent'] ?? 0}%',
                style: const TextStyle(color: AppColors.navy, fontWeight: FontWeight.bold, fontSize: 14)),
            const Text('executado', style: TextStyle(color: AppColors.textSecondary, fontSize: 10)),
          ],
        ),
        onTap: () => context.push('/events/${event['id']}'),
      ),
    );
  }
}
