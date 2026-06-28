# -*- coding: utf-8 -*-
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(r"C:\APS-EDU\SISTEMA DE GESTÃO - SOFI")
OUT_DIR = ROOT / "output" / "pdf"
PDF_PATH = OUT_DIR / "formulario_inteligente_lideranca_temperamento_produtividade.pdf"


def register_fonts():
    fonts = {
        "Arial": r"C:\Windows\Fonts\arial.ttf",
        "Arial-Bold": r"C:\Windows\Fonts\arialbd.ttf",
        "Arial-Italic": r"C:\Windows\Fonts\ariali.ttf",
        "Arial-BoldItalic": r"C:\Windows\Fonts\arialbi.ttf",
    }
    for name, path in fonts.items():
        if Path(path).exists():
            pdfmetrics.registerFont(TTFont(name, path))


def pstyle(name, size=10, leading=None, color=colors.black, alignment=TA_LEFT,
           spaceBefore=0, spaceAfter=0, bold=False):
    if leading is None:
        leading = size + 2
    return ParagraphStyle(
        name=name,
        fontName="Arial-Bold" if bold else "Arial",
        fontSize=size,
        leading=leading,
        textColor=color,
        alignment=alignment,
        spaceBefore=spaceBefore,
        spaceAfter=spaceAfter,
    )


def para(text, style):
    return Paragraph(text.replace("\n", "<br/>").replace("&", "&amp;"), style)


def bullet(items, style):
    return [para(f"• {x}", style) for x in items]


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D7DFEA"))
    canvas.setLineWidth(0.4)
    canvas.line(doc.leftMargin, 0.55 * inch, letter[0] - doc.rightMargin, 0.55 * inch)
    canvas.setFont("Arial", 8)
    canvas.setFillColor(colors.HexColor("#6B7280"))
    canvas.drawString(doc.leftMargin, 0.37 * inch, "APS EDU - SOFI | Formulario inteligente e guia de correção")
    canvas.drawRightString(letter[0] - doc.rightMargin, 0.37 * inch, f"Página {doc.page}")
    canvas.restoreState()


register_fonts()
styles = getSampleStyleSheet()
styles.add(pstyle("doc_title", size=20, leading=24, color=colors.HexColor("#163A63"), bold=True, spaceAfter=6))
styles.add(pstyle("doc_subtitle", size=9.5, leading=12, color=colors.HexColor("#4B5563"), spaceAfter=10))
styles.add(pstyle("doc_section", size=13.2, leading=16, color=colors.HexColor("#1F4D78"), bold=True, spaceBefore=8, spaceAfter=5))
styles.add(pstyle("doc_subsection", size=10.8, leading=13, color=colors.black, bold=True, spaceBefore=6, spaceAfter=4))
styles.add(pstyle("doc_body", size=9.5, leading=12, color=colors.HexColor("#111827"), spaceAfter=5))
styles.add(pstyle("doc_small", size=8.2, leading=10, color=colors.HexColor("#374151")))
styles.add(pstyle("doc_cell", size=8.5, leading=10.3, color=colors.HexColor("#111827")))
styles.add(pstyle("doc_head", size=8.6, leading=10.1, color=colors.HexColor("#1F3A5F"), bold=True))


def make_table(headers, rows, col_widths, head_fill="#E8EEF5"):
    data = [[para(f"<b>{h}</b>", styles["doc_head"]) for h in headers]]
    data.extend(rows)
    table = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(head_fill)),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1F3A5F")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#C9D4E2")),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#DCE4EE")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


def add_block(story, title, start_no, questions, response_text, reverse_text=None):
    story.append(para(title, styles["doc_subsection"]))
    story.append(para(response_text, styles["doc_small"]))
    if reverse_text:
        story.append(para(reverse_text, styles["doc_small"]))
    rows = [[para(f"<b>{i}</b>", styles["doc_cell"]), para(q, styles["doc_cell"])] for i, q in enumerate(questions, start=start_no)]
    story.append(make_table(["#", "Pergunta"], rows, [0.45 * inch, 6.05 * inch]))


story = []
story.append(para("FORMULÁRIO INTELIGENTE APS EDU", styles["doc_title"]))
story.append(para(
    "Liderança, temperamento, relacionamento interpessoal e produtividade.\n"
    "Documento de handoff para a nova conversa / novo projeto, com perguntas, parâmetros de resposta, regras de cálculo, alertas e integração com Drive.",
    styles["doc_subtitle"]
))

story.append(make_table(
    ["Campo", "Conteúdo"],
    [
        [para("<b>Base oficial</b>", styles["doc_cell"]), para("C:\\APS-EDU\\SISTEMA DE GESTÃO - SOFI", styles["doc_cell"])],
        [para("<b>Módulo principal</b>", styles["doc_cell"]), para("Pessoas / Performance Humana", styles["doc_cell"])],
        [para("<b>Destino dos dados</b>", styles["doc_cell"]), para("Plataforma APS EDU + Google Drive", styles["doc_cell"])],
        [para("<b>Finalidade</b>", styles["doc_cell"]), para("Coletar respostas, calcular índices, salvar foto, anexos e gerar relatórios", styles["doc_cell"])],
        [para("<b>Versão</b>", styles["doc_cell"]), para("Documento de transferência operacional", styles["doc_cell"])],
    ],
    [1.7 * inch, 4.9 * inch],
))
story.append(Spacer(1, 0.10 * inch))

story.append(para("RESUMO EXECUTIVO", styles["doc_section"]))
story.append(para(
    "Este formulário transforma a avaliação de pessoas em uma rotina padronizada e auditável. A plataforma deve permitir cadastro com foto, respostas guiadas, cálculo automático dos índices, salvamento em tempo real, geração de relatório completo/segmentado e criação de link para envio ao promotor. Nenhum dado deve se perder entre a base interna e o Google Drive.",
    styles["doc_body"]
))

story.append(para("1. ESTRUTURA DO FORMULÁRIO", styles["doc_section"]))
story.append(para("Fluxo recomendado: cadastro do promotor -> foto -> dados básicos -> blocos de perguntas -> cálculo automatizado -> salvamento -> envio para Drive -> geração de link compartilhável.", styles["doc_body"]))
story.append(make_table(
    ["Etapa", "O que precisa existir"],
    [
        [para("<b>Cadastro</b>", styles["doc_cell"]), para("Nome completo, foto, email, telefone, unidade, cargo, avaliador e data.", styles["doc_cell"])],
        [para("<b>Bloco 1</b>", styles["doc_cell"]), para("Liderança e influência.", styles["doc_cell"])],
        [para("<b>Bloco 2</b>", styles["doc_cell"]), para("Perfil comportamental e relacionamento.", styles["doc_cell"])],
        [para("<b>Bloco 3</b>", styles["doc_cell"]), para("Produtividade e entrega.", styles["doc_cell"])],
        [para("<b>Bloco 4</b>", styles["doc_cell"]), para("Autopercepção, maturidade e validação.", styles["doc_cell"])],
        [para("<b>Bloco 5</b>", styles["doc_cell"]), para("Cenários práticos e tomada de decisão.", styles["doc_cell"])],
        [para("<b>Saída</b>", styles["doc_cell"]), para("Índices, alertas, classificação final, resumo executivo e relatório completo.", styles["doc_cell"])],
    ],
    [1.55 * inch, 5.05 * inch],
))

story.append(para("2. PARÂMETRO PADRÃO DE RESPOSTA", styles["doc_section"]))
story.append(para("Blocos 1 a 4 usam escala Likert de 5 pontos. O bloco 5 usa múltipla escolha com chave de correção por item.", styles["doc_body"]))
likert_rows = [
    [para("<b>1</b>", styles["doc_cell"]), para("Discordo totalmente / Muito abaixo do esperado", styles["doc_cell"]), para("0 a 20", styles["doc_cell"])],
    [para("<b>2</b>", styles["doc_cell"]), para("Discordo / Abaixo do esperado", styles["doc_cell"]), para("21 a 40", styles["doc_cell"])],
    [para("<b>3</b>", styles["doc_cell"]), para("Neutro / Em desenvolvimento", styles["doc_cell"]), para("41 a 60", styles["doc_cell"])],
    [para("<b>4</b>", styles["doc_cell"]), para("Concordo / Bom nível", styles["doc_cell"]), para("61 a 80", styles["doc_cell"])],
    [para("<b>5</b>", styles["doc_cell"]), para("Concordo totalmente / Excelência", styles["doc_cell"]), para("81 a 100", styles["doc_cell"])],
]
story.append(make_table(["Valor", "Leitura", "Faixa base"], likert_rows, [0.8 * inch, 4.0 * inch, 1.0 * inch]))
story.append(para("Regra de pontuação: itens positivos usam leitura direta; itens negativos usam leitura inversa. No cálculo automatizado, a plataforma deve normalizar todas as respostas para a escala 0-100.", styles["doc_body"]))
story.append(para("Padrão de chaveamento: leitura direta = maior concordância, maior pontuação. Leitura inversa = maior concordância, menor pontuação.", styles["doc_body"]))

story.append(para("3. QUESTIONÁRIO COMPLETO", styles["doc_section"]))
story.append(para("Blocos 1 a 4: resposta padrão Likert 1-5. Bloco 4: itens 37 a 47 com inversão de pontuação. Bloco 5: respostas de cenários com matriz de correção por item.", styles["doc_body"]))

block1 = [
    "Quando identifico um problema, costumo agir antes que alguém me solicite.",
    "Pessoas da equipe costumam me procurar para pedir orientação ou conselho.",
    "Tenho facilidade para tomar decisões mesmo quando não possuo todas as informações.",
    "Frequentemente proponho melhorias para processos já existentes.",
    "Quando algo dá errado, procuro assumir minha parcela de responsabilidade.",
    "Sinto-me confortável em conduzir grupos ou equipes.",
    "Tenho facilidade para delegar atividades quando necessário.",
    "Procuro desenvolver ou ensinar colegas quando percebo dificuldades.",
    "Consigo manter a calma e direcionar pessoas em situações de pressão.",
    "Gosto de assumir responsabilidades além das minhas atribuições formais.",
    "Costumo pensar nas consequências de longo prazo das decisões tomadas.",
    "Tenho facilidade para influenciar positivamente as pessoas ao meu redor.",
]
block2 = [
    "Tenho facilidade para iniciar conversas com pessoas que não conheço.",
    "Procuro ouvir opiniões diferentes antes de tomar decisões importantes.",
    "Recebo críticas ou feedbacks sem me sentir pessoalmente atacado.",
    "Consigo trabalhar bem com pessoas que possuem perfis diferentes do meu.",
    "Quando surge um conflito, procuro compreender todos os envolvidos antes de agir.",
    "Sou visto como uma pessoa acessível pelos colegas.",
    "Consigo separar emoções pessoais das decisões profissionais.",
    "Mantenho o equilíbrio emocional mesmo em períodos de alta pressão.",
    "Tenho facilidade para me adaptar a mudanças de processos ou rotinas.",
    "Consigo expressar minhas opiniões sem gerar conflitos desnecessários.",
    "Costumo colaborar espontaneamente com colegas quando percebo necessidade.",
    "Tenho facilidade para construir relacionamentos de confiança.",
]
block3 = [
    "Entrego minhas atividades dentro dos prazos estabelecidos.",
    "Organizo minhas prioridades antes de iniciar minhas atividades.",
    "Consigo manter a produtividade mesmo quando possuo diversas demandas simultâneas.",
    "Raramente preciso ser lembrado sobre compromissos assumidos.",
    "Tenho facilidade para concluir tarefas iniciadas.",
    "Costumo revisar meu trabalho antes de entregá-lo.",
    "Busco soluções antes de solicitar ajuda.",
    "Mantenho consistência na qualidade das minhas entregas.",
    "Aprendo rapidamente novos processos, ferramentas ou sistemas.",
    "Procuro constantemente formas de melhorar minha maneira de trabalhar.",
    "Tenho disciplina para executar tarefas mesmo quando não estou motivado.",
    "Consigo administrar meu tempo de forma eficiente.",
]
block4 = [
    "Já deixei de cumprir um prazo por falha de organização pessoal.",
    "Tenho dificuldade em dizer \"não\" quando recebo novas demandas.",
    "Algumas vezes assumo mais responsabilidades do que consigo executar.",
    "Já tive conflitos profissionais que poderiam ter sido evitados.",
    "Costumo adiar atividades que considero desagradáveis ou difíceis.",
    "Nem sempre peço ajuda quando realmente preciso.",
    "Em algumas situações tenho dificuldade em aceitar opiniões diferentes das minhas.",
    "Já deixei de fornecer um feedback necessário para evitar desconforto.",
    "Em determinados momentos permito que emoções influenciem minhas decisões profissionais.",
    "Algumas vezes me sinto sobrecarregado pelas responsabilidades que assumo.",
    "Já percebi que minhas prioridades estavam desalinhadas com as prioridades da equipe.",
    "Reconheço com facilidade meus erros quando eles acontecem.",
    "Procuro aprender com críticas e feedbacks recebidos.",
    "Estou aberto a mudar comportamentos quando percebo que eles prejudicam meus resultados.",
    "Busco constantemente meu desenvolvimento pessoal e profissional.",
    "Consigo identificar com clareza meus principais pontos de melhoria.",
]
scenarios = [
    ("Você percebe que um colega está cometendo repetidamente um erro que pode prejudicar os resultados da equipe. Qual seria sua reação mais provável?", ["Conversaria diretamente com ele para ajudá-lo a corrigir o problema.", "Corrigiria o problema por conta própria.", "Informaria imediatamente o gestor.", "Aguardaria para verificar se ele percebe sozinho."]),
    ("Você recebe três demandas urgentes para o mesmo prazo. Qual sua atitude mais comum?", ["Priorizo as atividades e comunico possíveis impactos.", "Tento realizar tudo sozinho.", "Solicito apoio imediatamente.", "Executo conforme as demandas surgem."]),
    ("Um projeto importante falha por um erro coletivo da equipe.", ["Procuro entender as causas e corrigir o processo.", "Identifico os responsáveis.", "Aguardo orientações superiores.", "Evito me envolver diretamente."]),
    ("Um colega recebe reconhecimento por uma ideia semelhante à sua.", ["Fico satisfeito pelo resultado alcançado pela equipe.", "Converso posteriormente sobre minha contribuição.", "Sinto-me injustiçado.", "Perco parte da motivação."]),
    ("Você recebe um feedback que considera injusto.", ["Escuto, reflito e avalio o que pode ser aproveitado.", "Defendo imediatamente meu ponto de vista.", "Aceito externamente, mas ignoro o feedback.", "Fico incomodado por um longo período."]),
    ("Um colaborador da equipe apresenta desempenho abaixo do esperado.", ["Procuro compreender as causas e ajudá-lo a evoluir.", "Assumo as atividades para garantir o resultado.", "Reporto imediatamente ao superior.", "Evito me envolver."]),
    ("Uma mudança importante é implementada na instituição.", ["Procuro entender rapidamente e me adaptar.", "Espero para ver como funcionará.", "Demonstro resistência até entender completamente.", "Continuo trabalhando da forma anterior."]),
    ("Durante uma reunião existe forte discordância sobre uma decisão.", ["Procuro construir consenso entre os envolvidos.", "Defendo minha posição até o final.", "Acompanho a decisão da maioria.", "Evito participar da discussão."]),
    ("Você identifica uma oportunidade de melhoria fora da sua área de atuação.", ["Apresento a sugestão de forma construtiva.", "Aguardo ser consultado.", "Faço apenas se for minha responsabilidade.", "Ignoro a situação."]),
    ("Você precisa liderar uma equipe para um projeto importante.", ["Defino objetivos claros e acompanho o progresso.", "Concentro as decisões em mim para garantir qualidade.", "Deixo cada um trabalhar da sua maneira.", "Aguardo orientações antes de agir."]),
]

add_block(story, "BLOCO 1 - LIDERANÇA E INFLUÊNCIA (1 a 12)", 1, block1, "Modelo de resposta: Likert 1-5 com leitura direta.")
story.append(Spacer(1, 0.08 * inch))
add_block(story, "BLOCO 2 - PERFIL COMPORTAMENTAL E RELACIONAMENTO (13 a 24)", 13, block2, "Modelo de resposta: Likert 1-5 com leitura direta.")
story.append(Spacer(1, 0.08 * inch))
add_block(story, "BLOCO 3 - PRODUTIVIDADE E ENTREGA (25 a 36)", 25, block3, "Modelo de resposta: Likert 1-5 com leitura direta.")
story.append(Spacer(1, 0.08 * inch))
add_block(
    story,
    "BLOCO 4 - AUTOPERCEPÇÃO, MATURIDADE E VALIDAÇÃO (37 a 52)",
    37,
    block4,
    "Modelo de resposta: Likert 1-5.",
    "Itens 37 a 47 usam leitura inversa porque concordar com a frase representa um sinal de risco ou menor maturidade. Itens 48 a 52 usam leitura direta."
)
story.append(Spacer(1, 0.08 * inch))
story.append(para("BLOCO 5 - CENÁRIOS PRÁTICOS E TOMADA DE DECISÃO (53 a 62)", styles["doc_subsection"]))
story.append(para("Modelo de resposta: múltipla escolha com 4 alternativas por item. A plataforma aplica matriz de correção por pergunta, preservando a opção mais aderente ao comportamento desejado como pontuação mais alta.", styles["doc_small"]))
for idx, (question, options) in enumerate(scenarios, start=53):
    story.append(para(f"<b>{idx}.</b> {question}", styles["doc_body"]))
    story.append(para("<br/>".join([f"<b>{label})</b> {option}" for label, option in zip(["A", "B", "C", "D"], options)]), styles["doc_small"]))
    story.append(Spacer(1, 0.03 * inch))

story.append(PageBreak())
story.append(para("4. ÍNDICES, PESOS E FAIXAS DE INTERPRETAÇÃO", styles["doc_section"]))
story.append(para("A correção final combina os blocos, aplica os pesos abaixo e gera o painel executivo da pessoa.", styles["doc_body"]))
index_rows = [
    [para("<b>1. Potencial de Liderança</b>", styles["doc_cell"]), para("20%", styles["doc_cell"]), para("1, 2, 3, 4, 6, 8, 9, 10, 11, 12, 58, 62", styles["doc_cell"]), para("90-100 = Líder Multiplicador; 80-89 = Líder Estratégico; 70-79 = Líder Operacional; 60-69 = Potencial em Desenvolvimento; 0-59 = Baixo Potencial de Liderança", styles["doc_cell"])] ,
    [para("<b>2. Potencial para Promoção</b>", styles["doc_cell"]), para("15%", styles["doc_cell"]), para("5, 10, 25, 26, 27, 29, 32, 34, 49, 50, 51, 52", styles["doc_cell"]), para("90-100 = Pronto para assumir novos desafios; 80-89 = Alto potencial; 70-79 = Potencial moderado; 60-69 = Necessita desenvolvimento; 0-59 = Não recomendado", styles["doc_cell"])] ,
    [para("<b>3. Inteligência Emocional</b>", styles["doc_cell"]), para("15%", styles["doc_cell"]), para("15, 17, 19, 20, 22, 40, 43, 45, 48, 49, 50, 57", styles["doc_cell"]), para("90-100 = Muito elevada; 80-89 = Elevada; 70-79 = Adequada; 60-69 = Necessita atenção; 0-59 = Crítica", styles["doc_cell"])] ,
    [para("<b>4. Maturidade Profissional</b>", styles["doc_cell"]), para("15%", styles["doc_cell"]), para("5, 15, 25, 30, 31, 35, 48, 49, 50, 51, 52, 55", styles["doc_cell"]), para("90-100 = Referência institucional; 80-89 = Muito madura; 70-79 = Madura; 60-69 = Em desenvolvimento; 0-59 = Baixa maturidade", styles["doc_cell"])] ,
    [para("<b>5. Produtividade</b>", styles["doc_cell"]), para("15%", styles["doc_cell"]), para("25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36", styles["doc_cell"]), para("90-100 = Alta Performance; 80-89 = Muito Bom; 70-79 = Bom; 60-69 = Regular; 0-59 = Necessita melhoria", styles["doc_cell"])] ,
    [para("<b>6. Relacionamento Interpessoal</b>", styles["doc_cell"]), para("10%", styles["doc_cell"]), para("13, 14, 16, 17, 18, 21, 22, 23, 24, 53, 58, 60", styles["doc_cell"]), para("90-100 = Excelente Relacionamento; 80-89 = Muito Bom; 70-79 = Adequado; 60-69 = Atenção; 0-59 = Crítico", styles["doc_cell"])] ,
]
story.append(make_table(["Índice", "Peso", "Perguntas base", "Faixas e leitura final"], index_rows, [1.65 * inch, 0.65 * inch, 1.7 * inch, 2.8 * inch]))

story.append(Spacer(1, 0.12 * inch))
story.append(para("5. ALERTAS AUTOMÁTICOS", styles["doc_section"]))
story.append(para("Esses alertas complementam os índices e ajudam a leitura executiva sem substituir o score principal.", styles["doc_body"]))
alert_rows = [
    [para("<b>Centralização</b>", styles["doc_cell"]), para("Perguntas 7, 8, 58 e 62. Critérios: alto em liderança e responsabilidade, baixo em delegação. Mensagem IA: tende a assumir responsabilidades excessivas e concentrar decisões, podendo limitar o desenvolvimento da equipe.", styles["doc_cell"])] ,
    [para("<b>Procrastinação</b>", styles["doc_cell"]), para("Perguntas 29, 35, 37 e 41. Resultado: baixo, moderado ou alto. Mensagem IA: tendência a adiar atividades complexas ou desagradáveis, impactando a consistência dos resultados.", styles["doc_cell"])] ,
    [para("<b>Risco de conflito</b>", styles["doc_cell"]), para("Perguntas 15, 16, 17, 22, 40, 43, 57 e 60. Mensagem IA: pode apresentar dificuldades em lidar com divergências, feedbacks ou opiniões contrárias.", styles["doc_cell"])] ,
    [para("<b>Resistência à mudança</b>", styles["doc_cell"]), para("Perguntas 21, 33, 50 e 59. Leitura final: adaptável, moderadamente adaptável ou resistente.", styles["doc_cell"])] ,
]
story.append(make_table(["Alerta", "Regra de leitura"], alert_rows, [1.35 * inch, 5.15 * inch], head_fill="#F4F6F9"))

story.append(Spacer(1, 0.12 * inch))
story.append(para("6. CONSISTÊNCIA DAS RESPOSTAS", styles["doc_section"]))
story.append(para("A consistência é o indicador mais importante do sistema. A plataforma deve cruzar respostas e sinalizar incoerências automaticamente.", styles["doc_body"]))
for item in [
    "Pergunta 25 x Pergunta 37: se a pessoa diz que entrega no prazo, mas também admite que perde prazos por desorganização, registrar alerta de inconsistência.",
    "Pergunta 15 x Pergunta 57: se recebe críticas bem, mas reage de forma defensiva a feedback injusto, registrar alerta de inconsistência.",
    "Pergunta 8 x Pergunta 58: se declara que desenvolve pessoas, mas prefere assumir a tarefa em vez de orientar o colaborador, registrar alerta de inconsistência.",
]:
    story.append(para(f"• {item}", styles["doc_body"]))
story.append(para("<b>Score de confiabilidade:</b> 95-100 = respostas altamente consistentes; 85-94 = boa consistência; 70-84 = algumas inconsistências; 60-69 = muitas inconsistências; abaixo de 60 = possível viés de autopromoção ou falta de autoconhecimento.", styles["doc_body"]))

story.append(Spacer(1, 0.1 * inch))
story.append(para("7. PERFIL FINAL AUTOMÁTICO", styles["doc_section"]))
story.append(make_table(
    ["Perfil", "Leitura executiva"],
    [
        [para("<b>Especialista</b>", styles["doc_cell"]), para("Alta produtividade / baixa liderança.", styles["doc_cell"])],
        [para("<b>Coordenador</b>", styles["doc_cell"]), para("Boa liderança, bom relacionamento e boa execução.", styles["doc_cell"])],
        [para("<b>Gestor</b>", styles["doc_cell"]), para("Alta liderança, alta inteligência emocional e alta maturidade.", styles["doc_cell"])],
        [para("<b>Diretor</b>", styles["doc_cell"]), para("Liderança estratégica, visão de longo prazo e desenvolvimento de pessoas.", styles["doc_cell"])],
        [para("<b>Multiplicador Institucional</b>", styles["doc_cell"]), para("Top 5% dos avaliados, com capacidade comprovada de formar líderes e influenciar cultura.", styles["doc_cell"])],
    ],
    [1.45 * inch, 5.05 * inch],
))

story.append(Spacer(1, 0.12 * inch))
story.append(para("8. MÓDULO DE TEMPERAMENTO E PERSONALIDADE NO RELATÓRIO", styles["doc_section"]))
story.append(para("Quando a pessoa for avaliada, o relatório deve exibir sempre os dois temperamentos predominantes, por exemplo 70% colérico / 30% melancólico. O objetivo é deixar claro o comportamento dominante e a característica de apoio.", styles["doc_body"]))
story.append(make_table(
    ["Temperamento", "Características essenciais"],
    [
        [para("<b>Sanguíneo</b>", styles["doc_cell"]), para("Comunicativo, entusiasmado, influente, sociável. Pode ter dificuldade com constância e organização.", styles["doc_cell"])],
        [para("<b>Colérico</b>", styles["doc_cell"]), para("Decisivo, competitivo, orientado para resultados, assume liderança. Pode ser impaciente ou centralizador.", styles["doc_cell"])],
        [para("<b>Fleumático</b>", styles["doc_cell"]), para("Calmo, estável, equilibrado e mediador. Pode evitar conflitos ou demorar para decidir.", styles["doc_cell"])],
        [para("<b>Melancólico</b>", styles["doc_cell"]), para("Analítico, organizado, detalhista e exigente. Pode ser crítico ou perfeccionista.", styles["doc_cell"])],
    ],
    [1.35 * inch, 5.15 * inch],
    head_fill="#F4F6F9"
))

story.append(Spacer(1, 0.12 * inch))
story.append(para("9. CAMPOS DE SAÍDA NA PLATAFORMA", styles["doc_section"]))
for item in [
    "Foto do promotor / colaborador.",
    "Nome completo, cargo, unidade, email e telefone.",
    "Resumo executivo da pessoa.",
    "Cartões de Liderança, Temperamento, Relacionamento Interpessoal e Produtividade.",
    "Níveis, perfis, potenciais e prontidão para liderança.",
    "Relatório completo e relatório segmentado.",
    "Arquivos anexados e histórico de alterações.",
    "Data da última atualização e status de salvamento em tempo real.",
]:
    story.append(para(f"• {item}", styles["doc_body"]))

story.append(para("10. INTEGRAÇÃO COM DRIVE E LINK COMPARTILHÁVEL", styles["doc_section"]))
story.append(para("A cada submissão, a plataforma deve criar ou atualizar uma pasta no Google Drive, registrar a foto e os anexos, salvar o PDF da resposta e manter o link do registro dentro do banco interno. O formulário também deve gerar um link compartilhável para envio ao promotor.", styles["doc_body"]))
story.append(para("Pasta sugerida no Drive: <b>APS EDU / Pessoas / Formulário Inteligente / [Nome do Promotor]</b>", styles["doc_body"]))

story.append(Spacer(1, 0.08 * inch))
story.append(para("11. RESUMO DE IMPLEMENTAÇÃO PARA A NOVA CONVERSA", styles["doc_section"]))
story.append(para("Se este documento for usado como handoff, o próximo passo é transformar as regras acima em telas, banco de dados, API de formulário, upload de foto, storage de arquivos, cálculo automático e exportação de relatório.", styles["doc_body"]))

story.append(PageBreak())
story.append(para("12. PARAMETRO DE RESPOSTAS QUE A PLATAFORMA DEVE EXIBIR", styles["doc_section"]))
story.append(para("Abaixo está a lógica que ajuda o promotor a responder com mais clareza e reduz ambiguidades na correção.", styles["doc_body"]))
story.append(make_table(
    ["Tipo de resposta", "Uso na plataforma"],
    [
        [para("<b>Likert 1-5</b>", styles["doc_cell"]), para("Avaliação de concordância e comportamento percebido.", styles["doc_cell"])],
        [para("<b>Múltipla escolha</b>", styles["doc_cell"]), para("Cenários práticos e decisão comportamental.", styles["doc_cell"])],
        [para("<b>Resposta inversa</b>", styles["doc_cell"]), para("Itens de risco, autoproteção ou baixa maturidade.", styles["doc_cell"])],
        [para("<b>Resposta direta</b>", styles["doc_cell"]), para("Itens de força, competência e consistência.", styles["doc_cell"])],
        [para("<b>Resposta descritiva</b>", styles["doc_cell"]), para("Comentários opcionais, contexto e observações do avaliador.", styles["doc_cell"])],
    ],
    [1.3 * inch, 5.2 * inch],
))

story.append(Spacer(1, 0.12 * inch))
story.append(para("13. MODELO DE TELA PARA CADASTRO DA PESSOA", styles["doc_section"]))
story.append(para("A plataforma pode apresentar o formulário com foto, nome, cargo, unidade, email, telefone, botões de salvar, gerar relatório completo, gerar relatório segmentado e criar link de envio. Ao final da submissão, o sistema deve mostrar o status 'salvo em tempo real'.", styles["doc_body"]))
story.append(make_table(
    ["Campo", "Observação"],
    [
        [para("<b>Foto</b>", styles["doc_cell"]), para("Upload ou captura da imagem do promotor.", styles["doc_cell"])],
        [para("<b>Resumo gráfico</b>", styles["doc_cell"]), para("Cartões com liderança, temperamento, relacionamento e produtividade.", styles["doc_cell"])],
        [para("<b>Salvar</b>", styles["doc_cell"]), para("Atualização em tempo real no banco e no Drive.", styles["doc_cell"])],
        [para("<b>Relatório completo</b>", styles["doc_cell"]), para("Visão detalhada com todos os índices, alertas e respostas.", styles["doc_cell"])],
        [para("<b>Relatório segmentado</b>", styles["doc_cell"]), para("Visão resumida por módulo: liderança, temperamento, relacionamento e produtividade.", styles["doc_cell"])],
    ],
    [1.4 * inch, 5.1 * inch],
))

PDF_PATH.parent.mkdir(parents=True, exist_ok=True)
doc = SimpleDocTemplate(
    str(PDF_PATH),
    pagesize=letter,
    leftMargin=0.58 * inch,
    rightMargin=0.58 * inch,
    topMargin=0.7 * inch,
    bottomMargin=0.8 * inch,
    title="Formulario Inteligente APS EDU",
    author="Codex",
    subject="Lideranca, temperamento, relacionamento e produtividade",
)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(PDF_PATH)
