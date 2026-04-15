import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class TaskCard extends StatelessWidget {
  final Map<String, dynamic> task;
  final VoidCallback onTap;

  const TaskCard({super.key, required this.task, required this.onTap});

  Color get _statusColor {
    switch (task['status']) {
      case 'completed': return AppColors.success;
      case 'in_progress': return AppColors.warning;
      case 'overdue': return AppColors.danger;
      default: return AppColors.textSecondary;
    }
  }

  String get _statusLabel {
    switch (task['status']) {
      case 'completed': return 'Concluída';
      case 'in_progress': return 'Em andamento';
      case 'overdue': return 'Atrasada';
      default: return 'Pendente';
    }
  }

  Color get _priorityColor {
    switch (task['priority']) {
      case 'critical': return AppColors.danger;
      case 'high': return AppColors.warning;
      case 'medium': return AppColors.info;
      default: return AppColors.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    final progress = task['progressPercent'] ?? 0;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border(left: BorderSide(color: _statusColor, width: 4)),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8)],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(task['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.textPrimary)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _statusColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(_statusLabel, style: TextStyle(color: _statusColor, fontSize: 11, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                if (task['assignedTo'] != null) ...[
                  const Icon(Icons.person_outline, size: 13, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text(task['assignedTo']?['name'] ?? '', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  const SizedBox(width: 12),
                ],
                if (task['dueDate'] != null) ...[
                  const Icon(Icons.calendar_today_outlined, size: 13, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text(_formatDate(task['dueDate']), style: TextStyle(fontSize: 12, color: task['status'] == 'overdue' ? AppColors.danger : AppColors.textSecondary)),
                ],
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: _priorityColor.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                  child: Text(_priorityLabel(task['priority']), style: TextStyle(color: _priorityColor, fontSize: 10, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: progress / 100,
                      backgroundColor: AppColors.border,
                      valueColor: AlwaysStoppedAnimation<Color>(_statusColor),
                      minHeight: 6,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text('$progress%', style: TextStyle(fontSize: 12, color: _statusColor, fontWeight: FontWeight.w600)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(String? date) {
    if (date == null) return '';
    try {
      final d = DateTime.parse(date);
      return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}';
    } catch (_) { return ''; }
  }

  String _priorityLabel(String? p) {
    switch (p) {
      case 'critical': return 'CRÍTICA';
      case 'high': return 'ALTA';
      case 'medium': return 'MÉDIA';
      default: return 'BAIXA';
    }
  }
}
