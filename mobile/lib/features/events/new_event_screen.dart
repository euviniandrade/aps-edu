import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class NewEventScreen extends StatefulWidget {
  const NewEventScreen({super.key});
  @override
  State<NewEventScreen> createState() => _NewEventScreenState();
}

class _NewEventScreenState extends State<NewEventScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  DateTime? _startDate;
  DateTime? _endDate;
  String? _unitId;
  List<String> _responsibleIds = [];
  List<Map<String, dynamic>> _timeline = [];
  List<dynamic> _users = [];
  List<dynamic> _units = [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([api.getUsers(), api.getUnits()]);
      setState(() { _users = results[0].data ?? []; _units = results[1].data ?? []; });
    } catch (_) {}
  }

  Future<void> _pickDate(bool isStart) async {
    final now = DateTime.now();
    final picked = await showDateTimePicker(context: context, initial: isStart ? now : (_startDate ?? now).add(const Duration(days: 1)));
    if (picked != null) setState(() => isStart ? _startDate = picked : _endDate = picked);
  }

  Future<DateTime?> showDateTimePicker({required BuildContext context, required DateTime initial}) async {
    final date = await showDatePicker(context: context, initialDate: initial, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 730)));
    if (date == null) return null;
    if (!context.mounted) return null;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(initial));
    if (time == null) return date;
    return DateTime(date.year, date.month, date.day, time.hour, time.minute);
  }

  void _addTimelineItem() {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Nova etapa da linha do tempo'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: ctrl, autofocus: true, decoration: const InputDecoration(hintText: 'Título da etapa...')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () {
              if (ctrl.text.trim().isNotEmpty) {
                setState(() => _timeline.add({'title': ctrl.text.trim(), 'scheduledAt': (_startDate ?? DateTime.now()).toIso8601String()}));
                Navigator.pop(context);
              }
            },
            child: const Text('Adicionar'),
          ),
        ],
      ),
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_startDate == null || _endDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Selecione as datas do evento'), backgroundColor: AppColors.danger));
      return;
    }
    setState(() => _saving = true);
    try {
      await api.createEvent({
        'name': _nameCtrl.text.trim(),
        'description': _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
        'location': _locationCtrl.text.trim(),
        'startDate': _startDate!.toIso8601String(),
        'endDate': _endDate!.toIso8601String(),
        'unitId': _unitId,
        'responsibleIds': _responsibleIds,
        'timeline': _timeline,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✅ Evento criado com sucesso!'), backgroundColor: AppColors.success));
        context.pop();
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Erro ao criar evento'), backgroundColor: AppColors.danger));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  String _formatDt(DateTime? dt) {
    if (dt == null) return 'Não definida';
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Novo Evento'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : const Text('Salvar', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Nome do evento *', prefixIcon: Icon(Icons.event_rounded)),
              validator: (v) => v == null || v.trim().isEmpty ? 'Nome obrigatório' : null,
            ),
            const SizedBox(height: 14),

            TextFormField(
              controller: _descCtrl,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Descrição (opcional)', prefixIcon: Icon(Icons.notes_rounded), alignLabelWithHint: true),
            ),
            const SizedBox(height: 14),

            TextFormField(
              controller: _locationCtrl,
              decoration: const InputDecoration(labelText: 'Local *', prefixIcon: Icon(Icons.location_on_rounded)),
              validator: (v) => v == null || v.trim().isEmpty ? 'Local obrigatório' : null,
            ),
            const SizedBox(height: 16),

            // Datas
            Row(children: [
              Expanded(child: _DateButton(label: 'Data início', value: _formatDt(_startDate), onTap: () => _pickDate(true))),
              const SizedBox(width: 10),
              Expanded(child: _DateButton(label: 'Data fim', value: _formatDt(_endDate), onTap: () => _pickDate(false))),
            ]),
            const SizedBox(height: 16),

            // Unidade
            _label('Unidade'),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _unitId,
              hint: const Text('Selecionar unidade'),
              decoration: const InputDecoration(prefixIcon: Icon(Icons.business_rounded)),
              items: _units.map((u) => DropdownMenuItem(value: u['id'].toString(), child: Text(u['name']))).toList(),
              onChanged: (v) => setState(() => _unitId = v),
            ),
            const SizedBox(height: 16),

            // Responsáveis
            _label('Responsáveis'),
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(color: Colors.white, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(10)),
              constraints: const BoxConstraints(maxHeight: 150),
              child: ListView(
                shrinkWrap: true,
                children: _users.map((u) {
                  final selected = _responsibleIds.contains(u['id'].toString());
                  return CheckboxListTile(
                    dense: true,
                    value: selected,
                    activeColor: AppColors.navy,
                    title: Text('${u['name']} — ${u['role']?['name'] ?? ''}', style: const TextStyle(fontSize: 13)),
                    onChanged: (v) => setState(() => v! ? _responsibleIds.add(u['id'].toString()) : _responsibleIds.remove(u['id'].toString())),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 20),

            // Linha do tempo
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              _label('Linha do Tempo (${_timeline.length} etapas)'),
              TextButton.icon(icon: const Icon(Icons.add, size: 16), label: const Text('Etapa'), onPressed: _addTimelineItem),
            ]),
            ..._timeline.asMap().entries.map((e) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(radius: 12, backgroundColor: AppColors.navy, child: Text('${e.key + 1}', style: const TextStyle(color: Colors.white, fontSize: 10))),
              title: Text(e.value['title'], style: const TextStyle(fontSize: 14)),
              trailing: IconButton(icon: const Icon(Icons.remove_circle_outline, color: AppColors.danger, size: 18), onPressed: () => setState(() => _timeline.removeAt(e.key))),
            )),

            const SizedBox(height: 40),
            ElevatedButton.icon(
              icon: const Icon(Icons.check_circle_outline),
              label: const Text('Criar Evento'),
              onPressed: _saving ? null : _save,
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _label(String text) => Text(text, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary));
}

class _DateButton extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback onTap;
  const _DateButton({required this.label, required this.value, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.white, border: Border.all(color: AppColors.border), borderRadius: BorderRadius.circular(10)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
          const SizedBox(height: 4),
          Row(children: [
            const Icon(Icons.calendar_today_rounded, color: AppColors.navy, size: 14),
            const SizedBox(width: 6),
            Expanded(child: Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500), overflow: TextOverflow.ellipsis)),
          ]),
        ]),
      ),
    );
  }
}
