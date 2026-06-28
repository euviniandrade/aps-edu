import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});
  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  DateTime _focusedMonth = DateTime.now();
  List<dynamic> _events = [];
  List<dynamic> _tasks = [];

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        api.getEvents(params: {'limit': '50'}),
        api.getTasks(params: {'limit': '50'}),
      ]);
      setState(() {
        _events = results[0].data['events'] ?? [];
        _tasks = results[1].data['tasks'] ?? [];
      });
    } catch (_) {}
  }

  List<dynamic> _itemsForDay(DateTime day) {
    final items = <dynamic>[];
    for (final e in _events) {
      try {
        final start = DateTime.parse(e['startDate']);
        final end = DateTime.parse(e['endDate']);
        if (!day.isBefore(DateTime(start.year, start.month, start.day)) &&
            !day.isAfter(DateTime(end.year, end.month, end.day))) {
          items.add({...e, '_type': 'event'});
        }
      } catch (_) {}
    }
    for (final t in _tasks) {
      if (t['dueDate'] != null) {
        try {
          final due = DateTime.parse(t['dueDate']);
          if (due.year == day.year && due.month == day.month && due.day == day.day) {
            items.add({...t, '_type': 'task'});
          }
        } catch (_) {}
      }
    }
    return items;
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final firstDay = DateTime(_focusedMonth.year, _focusedMonth.month, 1);
    final daysInMonth = DateTime(_focusedMonth.year, _focusedMonth.month + 1, 0).day;
    final startWeekday = firstDay.weekday % 7;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Calendário'),
        actions: [
          IconButton(icon: const Icon(Icons.today_rounded), onPressed: () => setState(() => _focusedMonth = DateTime.now())),
        ],
      ),
      body: Column(children: [
        // Header do mês
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(children: [
            IconButton(icon: const Icon(Icons.chevron_left), onPressed: () => setState(() => _focusedMonth = DateTime(_focusedMonth.year, _focusedMonth.month - 1))),
            Expanded(child: Text(_monthName(_focusedMonth), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold), textAlign: TextAlign.center)),
            IconButton(icon: const Icon(Icons.chevron_right), onPressed: () => setState(() => _focusedMonth = DateTime(_focusedMonth.year, _focusedMonth.month + 1))),
          ]),
        ),

        // Dias da semana
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(children: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) =>
            Expanded(child: Center(child: Text(d, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary))))
          ).toList()),
        ),

        // Grade de dias
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 7, childAspectRatio: 1),
            itemCount: startWeekday + daysInMonth,
            itemBuilder: (_, i) {
              if (i < startWeekday) return const SizedBox();
              final day = DateTime(_focusedMonth.year, _focusedMonth.month, i - startWeekday + 1);
              final isToday = day.year == now.year && day.month == now.month && day.day == now.day;
              final items = _itemsForDay(day);
              return GestureDetector(
                onTap: items.isEmpty ? null : () {
                  showModalBottomSheet(context: context, builder: (_) => ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Text('${day.day}/${day.month}/${day.year}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      const SizedBox(height: 12),
                      ...items.map((item) => ListTile(
                        leading: Icon(item['_type'] == 'event' ? Icons.event_rounded : Icons.check_circle_outline, color: item['_type'] == 'event' ? AppColors.navy : AppColors.warning),
                        title: Text(item['name'] ?? item['title'] ?? '', style: const TextStyle(fontSize: 14)),
                        onTap: () { Navigator.pop(context); context.push('/${item['_type']}s/${item['id']}'); },
                      )),
                    ],
                  ));
                },
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Container(
                    width: 30, height: 30,
                    decoration: BoxDecoration(
                      color: isToday ? AppColors.navy : Colors.transparent,
                      shape: BoxShape.circle,
                    ),
                    child: Center(child: Text('${day.day}', style: TextStyle(fontSize: 13, fontWeight: isToday ? FontWeight.bold : FontWeight.normal, color: isToday ? Colors.white : AppColors.textPrimary))),
                  ),
                  if (items.isNotEmpty)
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      if (items.any((i) => i['_type'] == 'event'))
                        Container(width: 5, height: 5, margin: const EdgeInsets.only(right: 2), decoration: const BoxDecoration(color: AppColors.navy, shape: BoxShape.circle)),
                      if (items.any((i) => i['_type'] == 'task'))
                        Container(width: 5, height: 5, decoration: const BoxDecoration(color: AppColors.warning, shape: BoxShape.circle)),
                    ]),
                ]),
              );
            },
          ),
        ),

        const Divider(),
        // Legenda
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(children: [
            Container(width: 10, height: 10, decoration: const BoxDecoration(color: AppColors.navy, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            const Text('Eventos', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
            const SizedBox(width: 16),
            Container(width: 10, height: 10, decoration: const BoxDecoration(color: AppColors.warning, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            const Text('Prazos de tarefas', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ]),
        ),
      ]),
    );
  }

  String _monthName(DateTime d) {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return '${months[d.month - 1]} ${d.year}';
  }
}
