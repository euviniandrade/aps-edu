import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_theme.dart';

class NewTaskScreen extends StatefulWidget {
  const NewTaskScreen({super.key});
  @override
  State<NewTaskScreen> createState() => _NewTaskScreenState();
}

class _NewTaskScreenState extends State<NewTaskScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _priority = 'medium';
  DateTime? _dueDate;
  String? _assignedToId;
  String? _unitId;
  List<dynamic> _users = [];
  List<dynamic> _units = [];
  List<Map<String, dynamic>> _checklists = [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([
        api.getUsers(),
        api.getUnits(),
      ]);
      setState(() {
        _users = results[0].data ?? [];
        _units = results[1].data ?? [];
      });
    } catch (_) {}
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 7)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) setState(() => _dueDate = picked);
  }

  void _addChecklist() {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Novo item do checklist'),
        content: TextField(controller: ctrl, autofocus: true, decoration: const InputDecoration(hintText: 'Descreva o item...')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () {
              if (ctrl.text.trim().isNotEmpty) {
                setState(() => _checklists.add({'title': ctrl.text.trim()}));
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
    setState(() => _saving = true);
    try {
      await api.createTask({
        'title': _titleCtrl.text.trim(),
        'description': _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
        'priority': _priority,
        'dueDate': _dueDate?.toIso8601String(),
        'assignedToId': _assignedToId,
        'unitId': _unitId,
        'checklists': _checklists,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Tarefa criada com sucesso!'), backgroundColor: AppColors.success),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erro ao criar tarefa'), backgroundColor: AppColors.danger),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nova Tarefa'),
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
            // Título
            TextFormField(
              controller: _titleCtrl,
              decoration: const InputDecoration(labelText: 'Título da tarefa *', prefixIcon: Icon(Icons.title_rounded)),
              validator: (v) => v == null || v.trim().isEmpty ? 'Título obrigatório' : null,
            ),
            const SizedBox(height: 14),

            // Descrição
            TextFormField(
              controller: _descCtrl,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Descrição (opcional)', prefixIcon: Icon(Icons.notes_rounded), alignLabelWithHint: true),
            ),
            const SizedBox(height: 14),

            // Prioridade
            _label('Prioridade'),
            const SizedBox(height: 8),
            Row(
              children: [
                for (final p in [('low', 'Baixa', AppColors.info), ('medium', 'Média', AppColors.warning), ('high', 'Alta', AppColors.warning), ('critical', 'Crítica', AppColors.danger)])
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _priority = p.$1),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        margin: const EdgeInsets.only(right: 6),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: _priority == p.$1 ? p.$3.withOpacity(0.15) : Colors.white,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: _priority == p.$1 ? p.$3 : AppColors.border, width: _priority == p.$1 ? 2 : 1),
                        ),
                        child: Text(p.$2, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: _priority == p.$1 ? FontWeight.bold : FontWeight.normal, color: _priority == p.$1 ? p.$3 : AppColors.textSecondary)),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),

            // Data limite
            _label('Data limite'),
            const SizedBox(height: 8),
            InkWell(
              onTap: _pickDate,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: Colors.white, border: Border.all(color: AppColors.border),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(children: [
                  const Icon(Icons.calendar_today_rounded, color: AppColors.navy, size: 18),
                  const SizedBox(width: 10),
                  Text(
                    _dueDate != null ? '${_dueDate!.day.toString().padLeft(2, '0')}/${_dueDate!.month.toString().padLeft(2, '0')}/${_dueDate!.year}' : 'Selecionar data de vencimento',
                    style: TextStyle(color: _dueDate != null ? AppColors.textPrimary : AppColors.textSecondary),
                  ),
                  const Spacer(),
                  if (_dueDate != null) GestureDetector(onTap: () => setState(() => _dueDate = null), child: const Icon(Icons.close, size: 16, color: AppColors.textSecondary)),
                ]),
              ),
            ),
            const SizedBox(height: 16),

            // Responsável
            _label('Responsável'),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _assignedToId,
              hint: const Text('Selecionar responsável'),
              decoration: const InputDecoration(prefixIcon: Icon(Icons.person_rounded)),
              items: [
                const DropdownMenuItem(value: null, child: Text('Nenhum')),
                ..._users.map((u) => DropdownMenuItem(value: u['id'].toString(), child: Text('${u['name']} — ${u['role']?['name'] ?? ''}', overflow: TextOverflow.ellipsis))),
              ],
              onChanged: (v) => setState(() => _assignedToId = v),
            ),
            const SizedBox(height: 14),

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
            const SizedBox(height: 20),

            // Checklist
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              _label('Checklist (${_checklists.length} itens)'),
              TextButton.icon(icon: const Icon(Icons.add, size: 16), label: const Text('Adicionar'), onPressed: _addChecklist),
            ]),
            ..._checklists.asMap().entries.map((e) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.check_box_outline_blank, color: AppColors.textSecondary),
              title: Text(e.value['title'], style: const TextStyle(fontSize: 14)),
              trailing: IconButton(icon: const Icon(Icons.remove_circle_outline, color: AppColors.danger, size: 18), onPressed: () => setState(() => _checklists.removeAt(e.key))),
            )),

            const SizedBox(height: 40),
            ElevatedButton.icon(
              icon: const Icon(Icons.check_circle_outline),
              label: const Text('Criar Tarefa'),
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
