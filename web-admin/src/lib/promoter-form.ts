export type PromoterQuestionType = 'scale' | 'single'

export interface PromoterQuestionOption {
  label: string
  score: number
}

export interface PromoterQuestion {
  id: number
  sectionId: string
  prompt: string
  type: PromoterQuestionType
  reverse?: boolean
  help?: string
  options?: PromoterQuestionOption[]
}

export interface PromoterFormAnswers {
  [questionId: number]: number | string | undefined
}

export interface PromoterFormPayload {
  answers: PromoterFormAnswers
  promoterName: string
  unit: string
  role?: string
  email?: string
  phone?: string
  birthDate?: string
  address?: string
  photoName?: string
  photoMimeType?: string
  photoBase64?: string
  notes?: string
}

export interface PromoterFormResult {
  answeredCount: number
  totalQuestions: number
  indices: Record<string, { score: number; label: string; weight: number; summary: string }>
  temperament: {
    primary: string
    primaryPercent: number
    secondary: string
    secondaryPercent: number
    tertiary: string
    tertiaryPercent: number
    reason: string
  }
  behavioralProfile: {
    profile: string
    percent: number
    reason: string
  }
  productivity: {
    efficiency: number
    quality: number
    organization: number
    commitment: number
    autonomy: number
    index: number
    diagnosis: string
  }
  alerts: {
    centralization: { level: 'Baixo' | 'Moderado' | 'Alto'; message: string }
    procrastination: { level: 'Baixo' | 'Moderado' | 'Alto'; message: string }
    conflictRisk: { level: 'Baixo' | 'Moderado' | 'Alto'; message: string }
    changeResistance: { level: 'Adaptável' | 'Moderadamente Adaptável' | 'Resistente'; message: string }
    consistency: { score: number; message: string }
  }
  finalProfile: {
    title: 'Especialista' | 'Coordenador' | 'Gestor' | 'Diretor' | 'Multiplicador Institucional'
    description: string
  }
}

export interface PromoterFormSection {
  id: string
  title: string
  subtitle: string
  accent: string
  range: [number, number]
}

const SCORE_LEVELS = [
  { min: 90, label: 'Excelente' },
  { min: 80, label: 'Muito forte' },
  { min: 70, label: 'Forte' },
  { min: 60, label: 'Em desenvolvimento' },
  { min: 0, label: 'Atenção' },
]

function scaleQ(id: number, sectionId: string, prompt: string, reverse = false, help?: string): PromoterQuestion {
  return { id, sectionId, prompt, type: 'scale', reverse, help }
}

function singleQ(id: number, sectionId: string, prompt: string, options: Array<[string, number]>, help?: string): PromoterQuestion {
  return { id, sectionId, prompt, type: 'single', help, options: options.map(([label, score]) => ({ label, score })) }
}

export const PROMOTER_FORM_SECTIONS: PromoterFormSection[] = [
  {
    id: 'leadership',
    title: 'Liderança e Influência',
    subtitle: 'Capacidade de agir, orientar, influenciar e desenvolver pessoas.',
    accent: '#F8A303',
    range: [1, 12],
  },
  {
    id: 'personality',
    title: 'Perfil Comportamental e Relacionamento',
    subtitle: 'Temperamento, convivência, feedback e inteligência relacional.',
    accent: '#8B5CF6',
    range: [13, 24],
  },
  {
    id: 'productivity',
    title: 'Produtividade e Entrega',
    subtitle: 'Eficiência, organização, autonomia, qualidade e disciplina.',
    accent: '#0ABD78',
    range: [25, 36],
  },
  {
    id: 'maturity',
    title: 'Autopercepção, Maturidade e Validação',
    subtitle: 'Consciência de limites, abertura ao feedback e desenvolvimento contínuo.',
    accent: '#4A9EFF',
    range: [37, 52],
  },
  {
    id: 'scenarios',
    title: 'Cenários Práticos e Tomada de Decisão',
    subtitle: 'Escolhas reais para leitura executiva de comportamento.',
    accent: '#FF4757',
    range: [53, 62],
  },
]

export const PROMOTER_QUESTIONS: PromoterQuestion[] = [
  // Bloco 1 - escolhas forçadas e julgamento de liderança
  singleQ(1, 'leadership', 'Quando percebe um problema ainda pequeno, qual caminho mais combina com você?', [
    ['Mapeio rapidamente o impacto e aciono quem precisa decidir comigo.', 5],
    ['Resolvo sozinho para não atrasar a equipe.', 3],
    ['Registro o ponto e espero mais sinais antes de agir.', 2],
    ['Levo ao gestor com duas alternativas possíveis.', 4],
  ]),
  singleQ(2, 'leadership', 'Alguém novo na equipe pede ajuda em uma rotina importante. O que você tende a fazer?', [
    ['Mostro o caminho e deixo a pessoa executar com acompanhamento.', 5],
    ['Explico uma vez e sigo minhas demandas.', 3],
    ['Faço junto até garantir que ela entendeu o padrão.', 4],
    ['Indico quem sabe mais daquele assunto.', 2],
  ]),
  singleQ(3, 'leadership', 'Você precisa decidir com informações incompletas. Qual postura parece mais natural?', [
    ['Espero ter segurança total antes de assumir uma direção.', 2],
    ['Escolho a opção mais provável, deixo critérios claros e reviso rápido.', 5],
    ['Peço uma validação superior antes de qualquer movimento.', 3],
    ['Sigo a experiência anterior da equipe e observo o resultado.', 4],
  ]),
  singleQ(4, 'leadership', 'Um processo funciona, mas está cansativo para todos. Você normalmente...', [
    ['Sugere uma melhoria pequena, testável e com responsável definido.', 5],
    ['Comenta informalmente até alguém comprar a ideia.', 3],
    ['Mantém como está para evitar atrito.', 2],
    ['Procura entender os limites antes de propor mudança.', 4],
  ]),
  singleQ(5, 'leadership', 'Algo falha em uma entrega compartilhada. Sua primeira reação interna costuma ser...', [
    ['Entender minha parcela e o ajuste de processo necessário.', 5],
    ['Identificar onde a comunicação quebrou.', 4],
    ['Proteger minha parte para evitar injustiça.', 2],
    ['Esperar a avaliação do líder antes de concluir.', 3],
  ]),
  singleQ(6, 'leadership', 'Em uma reunião sem direção clara, você tende a...', [
    ['Escutar primeiro e organizar os próximos passos quando houver abertura.', 4],
    ['Assumir a condução e fechar encaminhamentos objetivos.', 5],
    ['Contribuir apenas quando perguntado.', 2],
    ['Apoiar quem estiver conduzindo para manter o grupo alinhado.', 3],
  ]),
  singleQ(7, 'leadership', 'Quando precisa dividir trabalho, o que mais combina com você?', [
    ['Distribuo por capacidade e combino prazo, critério e ponto de checagem.', 5],
    ['Divido apenas partes simples para garantir qualidade final.', 3],
    ['Prefiro concentrar o essencial e pedir apoio no operacional.', 2],
    ['Delego com liberdade e fico disponível se alguém chamar.', 4],
  ]),
  singleQ(8, 'leadership', 'Um colega está com dificuldade recorrente. Você provavelmente...', [
    ['Ajuda a pessoa a encontrar o padrão do erro e criar um método.', 5],
    ['Corrige a entrega para preservar o resultado.', 2],
    ['Dá uma orientação objetiva e acompanha a próxima tentativa.', 4],
    ['Encaminha para alguém com mais tempo para ensinar.', 3],
  ]),
  singleQ(9, 'leadership', 'Sob pressão, sua contribuição mais forte tende a ser...', [
    ['Dar ritmo e separar urgência real de ansiedade.', 5],
    ['Executar rápido para aliviar o volume.', 4],
    ['Manter silêncio para não aumentar tensão.', 2],
    ['Pedir uma pausa curta para reorganizar prioridades.', 3],
  ]),
  singleQ(10, 'leadership', 'Surge uma oportunidade fora da sua função direta. Você...', [
    ['Assume se houver impacto claro e combina limites.', 5],
    ['Ajuda discretamente sem formalizar responsabilidade.', 3],
    ['Espera ser convidado para não parecer invasivo.', 2],
    ['Oferece apoio pontual e informa quem deve liderar.', 4],
  ]),
  singleQ(11, 'leadership', 'Ao escolher uma solução, o que pesa mais para você?', [
    ['Velocidade agora, mesmo que depois precise ajustar.', 3],
    ['Clareza de impacto em pessoas, rotina e resultado futuro.', 5],
    ['O caminho mais aceito pela maioria.', 2],
    ['O que tem menor risco de retrabalho.', 4],
  ]),
  singleQ(12, 'leadership', 'Quando quer engajar pessoas em uma mudança, você costuma...', [
    ['Mostrar o motivo, ouvir receios e combinar um primeiro passo.', 5],
    ['Defender com energia até o grupo entender.', 3],
    ['Esperar a orientação institucional para reforçar a mensagem.', 2],
    ['Trazer exemplos práticos de benefício para a rotina.', 4],
  ]),

  // Bloco 2 - relacionamento, feedback e inteligência emocional
  singleQ(13, 'personality', 'Em um ambiente novo, você normalmente...', [
    ['Observa a dinâmica e se aproxima com intenção.', 4],
    ['Começa conversas e cria conexões rapidamente.', 5],
    ['Fica mais reservado até entender as pessoas.', 3],
    ['Interage apenas quando a rotina exige.', 2],
  ]),
  singleQ(14, 'personality', 'Diante de opiniões diferentes da sua, você tende a...', [
    ['Pedir exemplos para entender o raciocínio antes de decidir.', 5],
    ['Ouvir, mas manter a decisão se já estiver convencido.', 3],
    ['Buscar um ponto médio para preservar o clima.', 4],
    ['Evitar prolongar a conversa para não virar conflito.', 2],
  ]),
  singleQ(15, 'personality', 'Quando recebe um feedback duro, qual resposta é mais provável?', [
    ['Anoto, faço perguntas e separo fato de sensação.', 5],
    ['Explico meu lado para equilibrar a leitura.', 3],
    ['Agradeço e reflito melhor depois, com menos emoção.', 4],
    ['Fico defensivo quando percebo exagero.', 2],
  ]),
  singleQ(16, 'personality', 'Com pessoas muito diferentes de você, sua estratégia costuma ser...', [
    ['Ajustar linguagem e combinar expectativas práticas.', 5],
    ['Manter meu jeito e deixar a convivência amadurecer.', 3],
    ['Evitar temas sensíveis para manter harmonia.', 2],
    ['Descobrir o que motiva a pessoa e usar isso no trabalho.', 4],
  ]),
  singleQ(17, 'personality', 'Quando duas pessoas entram em atrito, você mais naturalmente...', [
    ['Escuta os lados e ajuda a traduzir interesses reais.', 5],
    ['Chama para objetividade e foco na entrega.', 4],
    ['Evita se envolver se não for sua responsabilidade.', 2],
    ['Leva para uma liderança mediar com isenção.', 3],
  ]),
  singleQ(18, 'personality', 'As pessoas costumam se aproximar de você porque você...', [
    ['Demonstra disponibilidade sem perder limites.', 5],
    ['Resolve rápido o que pedem.', 4],
    ['Escuta bastante, mesmo sem opinar muito.', 3],
    ['Conhece as regras e sabe apontar o caminho.', 2],
  ]),
  singleQ(19, 'personality', 'Quando uma decisão mexe com suas preferências pessoais, você...', [
    ['Declara o possível viés e decide pelo critério combinado.', 5],
    ['Pede outra opinião para conferir sua leitura.', 4],
    ['Segue o que parece mais justo no momento.', 3],
    ['Tem dificuldade se a escolha contrariar algo importante para você.', 2],
  ]),
  singleQ(20, 'personality', 'Em semanas de alta pressão, o que mais aparece em você?', [
    ['Organizo o essencial e comunico limites cedo.', 5],
    ['Aumento o ritmo e seguro a pressão até entregar.', 4],
    ['Fico mais quieto para manter o foco.', 3],
    ['Oscilo conforme as urgências chegam.', 2],
  ]),
  singleQ(21, 'personality', 'Uma rotina muda de uma hora para outra. Você...', [
    ['Entende o motivo e adapta seu método rapidamente.', 5],
    ['Testa na prática e ajusta com o tempo.', 4],
    ['Precisa de detalhes antes de confiar na mudança.', 3],
    ['Mantém o jeito antigo até ter certeza de que mudou mesmo.', 2],
  ]),
  singleQ(22, 'personality', 'Ao discordar de alguém, você costuma...', [
    ['Nomear o ponto técnico e cuidar do tom.', 5],
    ['Ser direto para não deixar dúvida.', 4],
    ['Esperar um momento privado para falar.', 3],
    ['Guardar a opinião quando sente que pode gerar atrito.', 2],
  ]),
  singleQ(23, 'personality', 'Quando percebe alguém sobrecarregado, você...', [
    ['Oferece ajuda especifica sem assumir tudo.', 5],
    ['Assume uma parte para resolver logo.', 4],
    ['Pergunta se a pessoa quer apoio.', 3],
    ['Espera o pedido para não invadir.', 2],
  ]),
  singleQ(24, 'personality', 'Para construir confiança, você aposta mais em...', [
    ['Coerencia entre combinados, entrega e conversa franca.', 5],
    ['Proximidade e boa relação no dia a dia.', 4],
    ['Competencia tecnica visivel.', 3],
    ['Tempo de convivência.', 2],
  ]),

  // Bloco 3 - produtividade, disciplina e entrega
  singleQ(25, 'productivity', 'Quando recebe uma demanda com prazo apertado, você...', [
    ['Alinha escopo, prazo e prioridade antes de executar.', 5],
    ['Começa imediatamente e ajusta no caminho.', 4],
    ['Faz o possível dentro do prazo e avisa ao final.', 2],
    ['Pede ajuda para dividir a carga.', 3],
  ]),
  singleQ(26, 'productivity', 'No inicio do dia, seu jeito de organizar trabalho costuma ser...', [
    ['Definir prioridades por impacto e prazo.', 5],
    ['Seguir a lista que já estava pendente.', 3],
    ['Resolver primeiro o que é mais rápido.', 2],
    ['Separar blocos de foco para o que exige mais cuidado.', 4],
  ]),
  singleQ(27, 'productivity', 'Com várias demandas simultâneas, você tende a...', [
    ['Criar uma fila clara e negociar o que não cabe.', 5],
    ['Alternar tarefas conforme a urgencia aparece.', 3],
    ['Trabalhar mais horas para absorver tudo.', 4],
    ['Esperar que as prioridades se esclarecam naturalmente.', 2],
  ]),
  singleQ(28, 'productivity', 'Para não esquecer compromissos, você...', [
    ['Usa agenda/lista e revisa combinados com frequencia.', 5],
    ['Confia bastante na memoria e em lembretes externos.', 2],
    ['Pede confirmações quando algo é importante.', 3],
    ['Cria alertas e deixa próximas ações visíveis.', 4],
  ]),
  singleQ(29, 'productivity', 'Quando uma tarefa fica longa ou pouco agradável, você...', [
    ['Divide em pequenas entregas e mantém avanco.', 5],
    ['Faz quando a pressão do prazo aumenta.', 2],
    ['Intercala com tarefas mais leves.', 3],
    ['Reserva um bloco de foco e tira da frente.', 4],
  ]),
  singleQ(30, 'productivity', 'Antes de entregar algo importante, você...', [
    ['Revisa com critérios e, se preciso, pede um segundo olhar.', 5],
    ['Confere o essencial para não atrasar.', 4],
    ['Entrega quando sente que está bom o suficiente.', 3],
    ['Prefere velocidade e corrige se alguém apontar.', 2],
  ]),
  singleQ(31, 'productivity', 'Ao travar em uma tarefa, você...', [
    ['Tenta diagnosticar, registra dúvidas e pede ajuda objetiva.', 5],
    ['Pesquisa alternativas antes de chamar alguém.', 4],
    ['Pede ajuda rápido para não perder tempo.', 3],
    ['Insiste sozinho por bastante tempo.', 2],
  ]),
  singleQ(32, 'productivity', 'Sobre qualidade, você se reconhece mais em...', [
    ['Consistência com melhoria contínua.', 5],
    ['Bom resultado quando a demanda e relevante.', 4],
    ['Entrega aceitavel mesmo em ritmo alto.', 3],
    ['Qualidade varia conforme volume e pressão.', 2],
  ]),
  singleQ(33, 'productivity', 'Quando aprende uma ferramenta nova, você...', [
    ['Testa, documenta atalhos e compartilha o que aprendeu.', 5],
    ['Aprende usando na necessidade real.', 4],
    ['Prefere receber um passo a passo antes.', 3],
    ['Usa apenas o básico até se sentir seguro.', 2],
  ]),
  singleQ(34, 'productivity', 'Ao notar retrabalho recorrente, você...', [
    ['Procura a causa e propoe ajuste de processo.', 5],
    ['Cria um jeito pessoal de evitar o problema.', 4],
    ['Corrige cada caso conforme aparece.', 3],
    ['Aceita como parte normal da rotina.', 2],
  ]),
  singleQ(35, 'productivity', 'Em dias sem motivação, você normalmente...', [
    ['Executa o combinado usando rotina e prioridade.', 5],
    ['Foca no mais urgente e deixa o restante para depois.', 3],
    ['Busca uma tarefa menor para retomar ritmo.', 4],
    ['Rende bem menos e tenta compensar outro dia.', 2],
  ]),
  singleQ(36, 'productivity', 'Para administrar tempo, você costuma...', [
    ['Proteger foco, combinar janelas e revisar prioridades.', 5],
    ['Responder tudo conforme chega para não acumular.', 2],
    ['Alternar entre atendimento e tarefas internas.', 3],
    ['Separar horarios para entregas mais importantes.', 4],
  ]),

  // Bloco 4 - maturidade, autoconsciencia e vies
  singleQ(37, 'maturity', 'Quando perde um prazo, o que mais provavelmente aconteceu?', [
    ['Subestimei complexidade e aprendi a quebrar melhor a entrega.', 4],
    ['Não acontece quase nunca; se acontece, aviso cedo e renegocio.', 5],
    ['Muitas urgências entraram e eu tentei absorver tudo.', 3],
    ['Percebi tarde que a prioridade tinha mudado.', 2],
  ]),
  singleQ(38, 'maturity', 'Quando recebe mais demandas do que cabe no tempo, você...', [
    ['Explica capacidade e negocia prioridade.', 5],
    ['Aceita e tenta dar conta para não frustrar ninguém.', 2],
    ['Pede ajuda depois que o volume aperta.', 3],
    ['Reorganiza e sinaliza riscos principais.', 4],
  ]),
  singleQ(39, 'maturity', 'Sobre assumir responsabilidades, seu padrão mais comum é...', [
    ['Assumo com critérios claros de prazo, impacto e apoio.', 5],
    ['Assumo bastante porque gosto de resolver.', 3],
    ['Prefiro assumir menos e entregar com segurança.', 4],
    ['As vezes assumo para evitar que algo fique sem dono.', 2],
  ]),
  singleQ(40, 'maturity', 'Se um conflito poderia ter sido evitado, você tende a concluir que...', [
    ['Faltou alinhar expectativa ou falar no momento certo.', 5],
    ['A outra parte não entendeu bem a situação.', 2],
    ['Eu deveria ter sido mais direto desde o inicio.', 4],
    ['Conflitos fazem parte e nem sempre da para evitar.', 3],
  ]),
  singleQ(41, 'maturity', 'Quando uma atividade é desconfortável, você...', [
    ['Começa pelo menor passo possível para destravar.', 5],
    ['Deixa para um momento com mais energia.', 3],
    ['Coloca prazo visivel e pede alguém para acompanhar.', 4],
    ['Prioriza tarefas mais claras primeiro.', 2],
  ]),
  singleQ(42, 'maturity', 'Quando precisa de ajuda, você geralmente...', [
    ['Chega com contexto, tentativa feita e pergunta objetiva.', 5],
    ['Pede ajuda assim que percebe risco de atraso.', 4],
    ['Tenta resolver sozinho para não incomodar.', 2],
    ['Pergunta para alguém de confiança antes de expor a dúvida.', 3],
  ]),
  singleQ(43, 'maturity', 'Quando alguém defende uma ideia oposta a sua, você...', [
    ['Procura o critério que sustenta a ideia antes de responder.', 5],
    ['Compara com dados e experiências anteriores.', 4],
    ['Sente resistencia, mas tenta manter abertura.', 3],
    ['Perde interesse quando a proposta parece pouco prática.', 2],
  ]),
  singleQ(44, 'maturity', 'Se precisa dar um feedback dificil, você...', [
    ['Marca conversa, usa fatos e combina próximo passo.', 5],
    ['Aguarda um momento mais leve para não desgastar.', 3],
    ['Fala de forma direta para resolver logo.', 4],
    ['Evita se a pessoa estiver sensivel.', 2],
  ]),
  singleQ(45, 'maturity', 'Quando está emocionalmente afetado, você...', [
    ['Reconhece o estado e evita decisões precipitadas.', 5],
    ['Tenta seguir normal para não demonstrar fraqueza.', 3],
    ['Pede tempo para pensar antes de responder.', 4],
    ['Responde rápido e depois ajusta se necessário.', 2],
  ]),
  singleQ(46, 'maturity', 'Quando sente sobrecarga, seu movimento mais comum e...', [
    ['Repriorizar, comunicar risco e pedir apoio específico.', 5],
    ['Segurar o máximo possível até passar.', 2],
    ['Cortar o que parece menos importante.', 3],
    ['Organizar a fila e entregar por etapas.', 4],
  ]),
  singleQ(47, 'maturity', 'Se percebe que suas prioridades desalinharem da equipe, você...', [
    ['Recalibra com a liderança e ajusta sua agenda.', 5],
    ['Conclui o que já iniciou e depois muda.', 3],
    ['Explica por que escolheu aquele caminho.', 2],
    ['Pede clareza sobre o que deve vir primeiro.', 4],
  ]),
  singleQ(48, 'maturity', 'Quando comete um erro visivel, você...', [
    ['Assume, corrige e registra aprendizado para não repetir.', 5],
    ['Corrige rápido antes de ampliar a conversa.', 4],
    ['Explica o contexto para que entendam a causa.', 3],
    ['Fica desconfortavel e prefere falar depois.', 2],
  ]),
  singleQ(49, 'maturity', 'Depois de uma critica util, você costuma...', [
    ['Transformar em uma ação observável.', 5],
    ['Guardar para refletir quando surgir situação parecida.', 3],
    ['Pedir exemplos para entender melhor.', 4],
    ['Aceitar, mas filtrar bastante antes de mudar.', 2],
  ]),
  singleQ(50, 'maturity', 'Quando identifica um comportamento seu que atrapalha o resultado, você...', [
    ['Define um ajuste pratico e acompanha se mudou de fato.', 5],
    ['Tenta melhorar aos poucos, conforme percebe o problema.', 3],
    ['Pede feedback para alguém acompanhar sua evolução.', 4],
    ['Muda se o impacto ficar muito claro para todos.', 2],
  ]),
  singleQ(51, 'maturity', 'Seu desenvolvimento profissional acontece melhor quando...', [
    ['Combino meta, prática e feedback frequente.', 5],
    ['Tenho um desafio real para resolver.', 4],
    ['Recebo treinamentos e materiais bem estruturados.', 3],
    ['A rotina abre espaco para aprender sem pressa.', 2],
  ]),
  singleQ(52, 'maturity', 'Sobre seus pontos de melhoria, você diria que...', [
    ['Consigo nomear, priorizar e agir sobre eles.', 5],
    ['Conheco os principais, mas nem sempre acompanho evolução.', 3],
    ['Peço ajuda para enxergar melhor quando necessário.', 4],
    ['Prefiro focar meus pontos fortes.', 2],
  ]),

  // Bloco 5 - cenarios práticos com alternativas plausíveis
  singleQ(53, 'scenarios', 'Um colega comete repetidamente um erro que pode prejudicar a equipe. Você...', [
    ['Conversa com ele em particular e oferece um caminho de correcao.', 5],
    ['Corrige por conta propria para proteger o resultado.', 3],
    ['Leva ao gestor com fatos e impacto, sem expor alem do necessário.', 4],
    ['Observa mais um pouco para confirmar o padrão.', 2],
  ]),
  singleQ(54, 'scenarios', 'Três demandas urgentes chegam para o mesmo prazo. Você...', [
    ['Tenta avançar nas três e entrega o máximo possível.', 3],
    ['Prioriza por impacto, comunica riscos e negocia prazo/apoio.', 5],
    ['Pede ajuda imediatamente antes de iniciar.', 4],
    ['Segue a ordem de chegada para ser justo.', 2],
  ]),
  singleQ(55, 'scenarios', 'Um projeto importante falha por erro coletivo. Você...', [
    ['Mapeia causas, responsabilidades compartilhadas e ajuste de processo.', 5],
    ['Identifica quem falhou para evitar repeticao.', 2],
    ['Aguarda orientação superior para não gerar ruído.', 3],
    ['Reune aprendizados e propoe uma correcao simples.', 4],
  ]),
  singleQ(56, 'scenarios', 'Um colega recebe reconhecimento por uma ideia parecida com a sua. Você...', [
    ['Valoriza o resultado e, depois, conversa sobre sua contribuição.', 5],
    ['Fica satisfeito pela equipe e deixa passar.', 4],
    ['Sente injustiça e reduz um pouco sua exposicao.', 2],
    ['Procura o líder para esclarecer autoria.', 3],
  ]),
  singleQ(57, 'scenarios', 'Você recebe um feedback que considera injusto. Você...', [
    ['Escuta, pede exemplos e decide o que pode aproveitar.', 5],
    ['Defende seu ponto para corrigir a percepcao.', 3],
    ['Aceita no momento e conversa depois com mais calma.', 4],
    ['Fica incomodado e demora para retomar confiança.', 2],
  ]),
  singleQ(58, 'scenarios', 'Alguém da equipe entrega abaixo do esperado. Você...', [
    ['Entende causa, combina apoio e acompanha a próxima entrega.', 5],
    ['Assume parte da tarefa para garantir o resultado.', 3],
    ['Reporta a situação para a liderança decidir.', 2],
    ['Da um direcionamento claro e monitora de perto.', 4],
  ]),
  singleQ(59, 'scenarios', 'Uma mudança institucional importante entra em vigor. Você...', [
    ['Entende o motivo e ajuda outros a traduzirem para a rotina.', 5],
    ['Adapta seu trabalho e observa onde surgem problemas.', 4],
    ['Espera exemplos concretos antes de mudar tudo.', 3],
    ['Mantém o método antigo até a mudança se estabilizar.', 2],
  ]),
  singleQ(60, 'scenarios', 'Em uma reunião com discordância forte, você...', [
    ['Ajuda o grupo a separar fatos, interesses e decisão.', 5],
    ['Defende sua posicao com firmeza.', 3],
    ['Apoia a maioria para encerrar o impasse.', 2],
    ['Faz perguntas para baixar tensão e clarear critérios.', 4],
  ]),
  singleQ(61, 'scenarios', 'Você vê uma melhoria fora da sua área direta. Você...', [
    ['Apresenta sugestão com cuidado, impacto e possível responsável.', 5],
    ['Comenta informalmente com alguém da área.', 3],
    ['Espera ser consultado para não ultrapassar limite.', 2],
    ['Compartilha a ideia como apoio, sem tentar conduzir.', 4],
  ]),
  singleQ(62, 'scenarios', 'Você precisa liderar um projeto importante. Você...', [
    ['Define objetivo, papeis, marcos e combinados de acompanhamento.', 5],
    ['Centraliza decisões críticas para garantir padrão.', 3],
    ['Da liberdade total e acompanha so no fim.', 2],
    ['Alinha plano com o grupo e ajusta conforme os riscos aparecem.', 4],
  ]),
]
const QUESTION_BY_ID = new Map(PROMOTER_QUESTIONS.map(question => [question.id, question]))

const INDEX_DEFINITIONS = [
  {
    key: 'leadershipPotential',
    label: 'Potencial de Liderança',
    weight: 20,
    questions: [1, 2, 3, 4, 6, 8, 9, 10, 11, 12, 58, 62],
    summary: 'Leitura da capacidade de assumir, direcionar e influenciar a equipe.',
  },
  {
    key: 'promotionPotential',
    label: 'Potencial para Promoção',
    weight: 15,
    questions: [5, 10, 25, 26, 27, 29, 32, 34, 49, 50, 51, 52],
    summary: 'Indica prontidão para desafios maiores e responsabilidades ampliadas.',
  },
  {
    key: 'emotionalIntelligence',
    label: 'Inteligência Emocional',
    weight: 15,
    questions: [15, 17, 19, 20, 22, 40, 43, 45, 48, 49, 50, 57],
    summary: 'Mostra maturidade relacional, escuta, autocontrole e resposta ao feedback.',
  },
  {
    key: 'professionalMaturity',
    label: 'Maturidade Profissional',
    weight: 15,
    questions: [5, 15, 25, 30, 31, 35, 48, 49, 50, 51, 52, 55],
    summary: 'Avalia consistência, responsabilidade, postura e abertura ao crescimento.',
  },
  {
    key: 'productivity',
    label: 'Produtividade',
    weight: 15,
    questions: [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
    summary: 'Reflete eficiência, organização, disciplina e constância de entrega.',
  },
  {
    key: 'interpersonalRelationship',
    label: 'Relacionamento Interpessoal',
    weight: 10,
    questions: [13, 14, 16, 17, 18, 21, 22, 23, 24, 53, 58, 60],
    summary: 'Mede convivência, colaboração, confiança e gestão de divergências.',
  },
] as const

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function normalizeQuestionScore(question: PromoterQuestion, answer: number | string | undefined) {
  if (answer === undefined || answer === null || answer === '') return null

  if (question.type === 'scale') {
    const numeric = clamp(Number(answer) || 1, 1, 5)
    const effective = question.reverse ? 6 - numeric : numeric
    return Math.round(((effective - 1) / 4) * 100)
  }

  const index = clamp(Number(answer) || 0, 0, (question.options?.length || 1) - 1)
  const option = question.options?.[index]
  if (!option) return null
  return Math.round(((option.score - 1) / 4) * 100)
}

function bandLabel(score: number) {
  if (score >= 90) return SCORE_LEVELS[0].label
  if (score >= 80) return SCORE_LEVELS[1].label
  if (score >= 70) return SCORE_LEVELS[2].label
  if (score >= 60) return SCORE_LEVELS[3].label
  return SCORE_LEVELS[4].label
}

function scoreIndex(answers: PromoterFormAnswers, questionIds: number[]) {
  const values = questionIds
    .map(id => {
      const question = QUESTION_BY_ID.get(id)
      return question ? normalizeQuestionScore(question, answers[id]) : null
    })
    .filter((value): value is number => typeof value === 'number')

  const score = Math.round(average(values))
  return clamp(score, 0, 100)
}

function extractQuestionRawScore(answers: PromoterFormAnswers, questionId: number) {
  const question = QUESTION_BY_ID.get(questionId)
  const raw = answers[questionId]
  if (!question || raw === undefined || raw === null || raw === '') return null
  if (question.type === 'scale') {
    return question.reverse ? 6 - clamp(Number(raw) || 1, 1, 5) : clamp(Number(raw) || 1, 1, 5)
  }
  const index = clamp(Number(raw) || 0, 0, (question.options?.length || 1) - 1)
  return question.options?.[index]?.score ?? null
}

function getTopAxis(scores: Record<string, number>) {
  const entries = Object.entries(scores)
  return entries.sort((a, b) => b[1] - a[1])[0]
}

function buildTemperament(scores: Record<string, number>) {
  const axes = {
    Sanguíneo: average([13, 18, 22, 23, 24, 56, 61].map(id => scores[`q${id}`] || 0)),
    Colérico: average([1, 3, 5, 6, 9, 10, 12, 53, 54, 58, 62].map(id => scores[`q${id}`] || 0)),
    Fleumático: average([14, 16, 17, 20, 21, 40, 59, 60].map(id => scores[`q${id}`] || 0)),
    Melancólico: average([11, 15, 19, 25, 26, 30, 31, 32, 33, 34, 35, 36, 48, 49, 50, 51, 52].map(id => scores[`q${id}`] || 0)),
  }

  const sorted = Object.entries(axes).sort((a, b) => b[1] - a[1])
  // Sum all 4 axes so percentages across the top 3 always total 100%
  const grandTotal = sorted.reduce((s, [, v]) => s + v, 0) || 1
  const primary = sorted[0][0]
  const secondary = sorted[1][0]
  const tertiary = sorted[2][0]

  // Distribute percentages across top 3, ensure they sum to exactly 100
  const p1 = Math.round((sorted[0][1] / grandTotal) * 100)
  const p2 = Math.round((sorted[1][1] / grandTotal) * 100)
  const p3 = 100 - p1 - p2

  const reasonMap: Record<string, string> = {
    Sanguíneo: 'Força social, comunicação, energia para pessoas e influência.',
    Colérico: 'Decisão, iniciativa, foco em resultados e ação executiva.',
    Fleumático: 'Equilíbrio, estabilidade, mediação e constância.',
    Melancólico: 'Análise, organização, detalhamento e busca por excelência.',
  }

  return {
    primary,
    secondary,
    tertiary,
    primaryPercent: p1,
    secondaryPercent: p2,
    tertiaryPercent: Math.max(0, p3),
    reason: `${reasonMap[primary] || ''} Segunda tendência: ${reasonMap[secondary] || ''}`,
  }
}

function buildBehavioralProfile(scores: Record<string, number>) {
  const axes = {
    Executor: average([1, 3, 5, 6, 25, 29, 35, 54, 58, 62].map(id => scores[`q${id}`] || 0)),
    Influenciador: average([2, 12, 13, 18, 22, 23, 24, 53, 56, 61].map(id => scores[`q${id}`] || 0)),
    Analítico: average([11, 15, 19, 26, 30, 31, 32, 48, 49, 52, 55].map(id => scores[`q${id}`] || 0)),
    Estavel: average([14, 16, 17, 20, 21, 40, 57, 59, 60].map(id => scores[`q${id}`] || 0)),
  }
  const [profile, percent] = getTopAxis(axes)
  const reasonMap: Record<string, string> = {
    Executor: 'Tende a agir com prontidão, foco e busca de resolução imediata.',
    Influenciador: 'Apresenta energia relacional, engajamento e capacidade de mobilização.',
    Analítico: 'Privilegia dados, precisão, planejamento e consistência de processo.',
    Estavel: 'Busca equilíbrio, previsibilidade e convivência harmoniosa.',
  }
  return {
    profile,
    percent: Math.round(percent),
    reason: reasonMap[profile] || '',
  }
}

function buildProductivity(scores: Record<string, number>) {
  const efficiency = Math.round(average([25, 27, 29, 31, 33, 35, 36].map(id => scores[`q${id}`] || 0)))
  const quality = Math.round(average([26, 30, 32, 48, 49, 50, 52].map(id => scores[`q${id}`] || 0)))
  const organization = Math.round(average([25, 26, 28, 30, 34, 35, 36].map(id => scores[`q${id}`] || 0)))
  const commitment = Math.round(average([25, 27, 29, 32, 35, 50, 51].map(id => scores[`q${id}`] || 0)))
  const autonomy = Math.round(average([31, 33, 34, 35, 36, 42, 50].map(id => scores[`q${id}`] || 0)))
  const index = Math.round((efficiency + quality + organization + commitment + autonomy) / 5)

  return {
    efficiency,
    quality,
    organization,
    commitment,
    autonomy,
    index,
    diagnosis: productivityDiagnosis(index),
  }
}

function productivityDiagnosis(value: number) {
  if (value >= 90) return 'Alta Performance'
  if (value >= 80) return 'Muito Bom'
  if (value >= 70) return 'Adequado'
  if (value >= 60) return 'Atenção'
  return 'Necessita Desenvolvimento'
}

function buildAlerts(answers: PromoterFormAnswers, questionScores: Record<string, number>) {
  const selectedScores = PROMOTER_QUESTIONS
    .map(question => extractQuestionRawScore(answers, question.id))
    .filter((score): score is number => typeof score === 'number')
  const averageScore = average(selectedScores)
  const scoreVariance = average(selectedScores.map(score => (score - averageScore) ** 2))
  const highScoreShare = selectedScores.length
    ? selectedScores.filter(score => score >= 5).length / selectedScores.length
    : 0
  const choiceIndexes = Object.values(answers)
    .filter(value => value !== undefined && value !== null && value !== '')
    .map(value => Number(value))
  const maxChoiceShare = choiceIndexes.length
    ? Math.max(...[0, 1, 2, 3, 4].map(index => choiceIndexes.filter(value => value === index).length / choiceIndexes.length))
    : 0

  const inverseRisk = (ids: number[]) => average(ids.map(id => 6 - Number(extractQuestionRawScore(answers, id) || 3)))

  const centralizationRisk = inverseRisk([7, 8, 58, 62])
  let centralizationLevel: 'Baixo' | 'Moderado' | 'Alto' = 'Baixo'
  if (centralizationRisk >= 4) centralizationLevel = 'Alto'
  else if (centralizationRisk >= 3) centralizationLevel = 'Moderado'

  const procrastinationRaw = inverseRisk([29, 35, 37, 41, 54])
  const procrastinationLevel: 'Baixo' | 'Moderado' | 'Alto' =
    procrastinationRaw >= 4 ? 'Alto' : procrastinationRaw >= 3 ? 'Moderado' : 'Baixo'

  const conflictRaw = inverseRisk([15, 16, 17, 22, 40, 43, 57, 60])
  const conflictLevel: 'Baixo' | 'Moderado' | 'Alto' = conflictRaw >= 4 ? 'Alto' : conflictRaw >= 3 ? 'Moderado' : 'Baixo'

  const changeRaw = average([21, 33, 50, 59].map(id => extractQuestionRawScore(answers, id) || 0))
  let changeLevel: 'Adaptável' | 'Moderadamente Adaptável' | 'Resistente' = 'Adaptável'
  if (changeRaw < 2.5) changeLevel = 'Resistente'
  else if (changeRaw < 4) changeLevel = 'Moderadamente Adaptável'

  const consistencyPairs = [
    [25, 37],
    [15, 57],
    [8, 58],
    [7, 62],
  ] as const

  let consistency = 100
  consistencyPairs.forEach(([a, b]) => {
    const left = extractQuestionRawScore(answers, a)
    const right = extractQuestionRawScore(answers, b)
    if (left === null || right === null) return
    if (a === 25 && b === 37 && left >= 5 && right <= 3) consistency -= 10
    if (a === 15 && b === 57 && left >= 5 && right <= 3) consistency -= 12
    if (a === 8 && b === 58 && left >= 5 && right <= 3) consistency -= 12
    if (a === 7 && b === 62 && left >= 4 && right <= 3) consistency -= 10
  })
  if (highScoreShare >= 0.85) consistency -= 30
  else if (highScoreShare >= 0.68) consistency -= 14
  if (scoreVariance < 0.35 && averageScore >= 4.4) consistency -= 16
  if (maxChoiceShare > 0.62) consistency -= 8

  consistency = clamp(consistency, 0, 100)

  return {
    centralization: {
      level: centralizationLevel,
      message:
        centralizationLevel === 'Alto'
          ? 'Tende a assumir responsabilidades excessivas e concentrar decisões, podendo limitar o desenvolvimento da equipe.'
          : centralizationLevel === 'Moderado'
            ? 'Apresenta indícios de concentração de responsabilidades em alguns contextos.'
            : 'Bom equilíbrio entre direção, delegação e desenvolvimento da equipe.',
    },
    procrastination: {
      level: procrastinationLevel,
      message:
        procrastinationLevel === 'Alto'
          ? 'Apresenta tendência a adiar atividades complexas ou desagradáveis, impactando consistência de resultados.'
          : procrastinationLevel === 'Moderado'
            ? 'Pode postergar algumas atividades quando ha sobrecarga ou pouca clareza.'
            : 'Boa disciplina e baixa tendência a postergação.',
    },
    conflictRisk: {
      level: conflictLevel,
      message:
        conflictLevel === 'Alto'
          ? 'Pode apresentar dificuldades em lidar com divergências, feedbacks ou opiniões contrárias.'
          : conflictLevel === 'Moderado'
            ? 'Tem alguns pontos de atenção na condução de conflitos e feedbacks.'
            : 'Boa maturidade para lidar com divergências e feedbacks.',
    },
    changeResistance: {
      level: changeLevel,
      message:
        changeLevel === 'Resistente'
          ? 'Mostra dificuldade para se adaptar a mudanças de rotinas e processos.'
          : changeLevel === 'Moderadamente Adaptável'
            ? 'Se adapta, mas pode precisar de mais tempo e contexto.'
            : 'Boa adaptabilidade a mudanças e ajustes de processo.',
    },
    consistency: {
      score: consistency,
      message:
        consistency >= 95
          ? 'Respostas altamente consistentes.'
          : consistency >= 85
            ? 'Boa consistência entre resposta direta e cenarios práticos.'
            : consistency >= 70
              ? 'Algumas inconsistências merecem revisão.'
              : 'Possível viés de autopromoção ou falta de autoconhecimento.',
    },
  }
}

function getFinalProfile(leadership: number, emotional: number, maturity: number, productivity: number, relationship: number, consistency: number) {
  if (leadership >= 90 && productivity >= 80 && relationship >= 80 && maturity >= 80 && consistency >= 85) {
    return {
      title: 'Multiplicador Institucional' as const,
      description: 'Top 5% dos avaliados, com capacidade comprovada de formar líderes e influenciar positivamente equipes e cultura organizacional.',
    }
  }

  if (leadership >= 80 && maturity >= 80 && productivity >= 75) {
    return {
      title: 'Diretor' as const,
      description: 'Liderança estratégica, visão de longo prazo e forte capacidade de desenvolver pessoas.',
    }
  }

  if (leadership >= 70 && emotional >= 70 && maturity >= 70) {
    return {
      title: 'Gestor' as const,
      description: 'Alta capacidade de conduzir pessoas, apoiar decisões e sustentar resultados com maturidade.',
    }
  }

  if (leadership >= 60 && relationship >= 60) {
    return {
      title: 'Coordenador' as const,
      description: 'Boa liderança operacional, relacionamento equilibrado e entrega consistente.',
    }
  }

  return {
    title: 'Especialista' as const,
    description: 'Alta produtividade ou conhecimento técnico, com liderança ainda em desenvolvimento.',
  }
}

export function computePromoterFormResult(answers: PromoterFormAnswers): PromoterFormResult {
  const normalizedAnswers: Record<string, number> = {}
  let answeredCount = 0

  PROMOTER_QUESTIONS.forEach(question => {
    const value = normalizeQuestionScore(question, answers[question.id])
    if (value !== null) {
      answeredCount += 1
      normalizedAnswers[`q${question.id}`] = value
    }
  })

  const indices = Object.fromEntries(
    INDEX_DEFINITIONS.map(def => {
      const score = scoreIndex(answers, [...def.questions])
      return [def.key, { score, label: def.label, weight: def.weight, summary: def.summary }]
    })
  )

  const temperament = buildTemperament(normalizedAnswers)
  const behavioralProfile = buildBehavioralProfile(normalizedAnswers)
  const productivity = buildProductivity(normalizedAnswers)
  const alerts = buildAlerts(answers, normalizedAnswers)
  const finalProfile = getFinalProfile(
    indices.leadershipPotential.score,
    indices.emotionalIntelligence.score,
    indices.professionalMaturity.score,
    indices.productivity.score,
    indices.interpersonalRelationship.score,
    alerts.consistency.score
  )

  return {
    answeredCount,
    totalQuestions: PROMOTER_QUESTIONS.length,
    indices,
    temperament,
    behavioralProfile,
    productivity,
    alerts,
    finalProfile,
  }
}

export function getPromoterFormQuestionSections() {
  return PROMOTER_FORM_SECTIONS.map(section => ({
    ...section,
    questions: PROMOTER_QUESTIONS.filter(question => question.sectionId === section.id),
  }))
}
