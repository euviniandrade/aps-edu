# WhatsApp CRM Module

**Status:** 🔄 Refactoring in Progress  
**Completion:** Phase 1 ✅ | Phase 2-3 ⏳  

---

## 📁 Estrutura

```
whatsapp/
├── page.tsx                    Main page (orchestrator, refactoring in progress)
├── types.ts                    ✅ All TypeScript interfaces & types
├── utils.ts                    ✅ Helpers, API, formatting utilities
├── README.md                   This file
├── REFACTORING_PLAN.md        ✅ Detailed refactoring roadmap (READ THIS FIRST)
└── components/
    ├── index.ts               ✅ Barrel exports
    ├── ConversasTab.tsx       ✅ Chat conversations tab (800 lines, 100% functional)
    ├── KanbanTab.tsx          ⏳ Coming soon (drag-and-drop pipeline)
    ├── EnvioEmMassaTab.tsx    ⏳ Coming soon (bulk messaging)
    ├── GruposTab.tsx          ⏳ Coming soon (group management)
    ├── SofiIATab.tsx          ⏳ Coming soon (AI automation)
    └── AnalyticsTab.tsx       ⏳ Coming soon (KPIs & charts)
```

---

## 🚀 Quick Start

### Current Status

**What works NOW:**
- ✅ WhatsApp Baileys connection (QR code scan)
- ✅ Real-time SSE events (messages, status updates)
- ✅ Chat list with search & filters
- ✅ Message history loading
- ✅ Send/receive messages
- ✅ Quick replies (/) templates
- ✅ Internal notes (private agent notes)
- ✅ Contact labels (VIP, Familia, etc)
- ✅ Pipeline stages (Inbox, Hoje, Acompanhar, etc)
- ✅ Archive/unarchive chats
- ✅ AI reply suggestions
- ✅ Message deletion with sync to device
- ✅ Unread badges

**What's coming:**
- ⏳ Kanban board (Phase 2)
- ⏳ Bulk messaging (Phase 2)
- ⏳ Group management (Phase 2)
- ⏳ AI automation dashboard (Phase 2)
- ⏳ Analytics/KPIs (Phase 2)

### Running

```bash
cd web-admin
npm run dev

# Open http://localhost:3000/whatsapp
```

---

## 🏗️ Architecture

### Types (`types.ts`)

All TypeScript interfaces are centralized here:

- `Contact` - WhatsApp contact with metadata
- `Message` - Individual message with status
- `WaState` - WhatsApp connection state
- `Stage` - Pipeline stage (Inbox, Hoje, etc)
- `ContactLabel` - Tags (VIP, Familia, etc)
- `QuickReply` - Quick reply template
- `InternalNote` - Private agent notes
- `Group` - WhatsApp group
- `MassRecipient` - Bulk message recipient
- `AiState` - AI automation settings
- `InstagramState/Rule/Event` - Instagram integration

### Utils (`utils.ts`)

Helper functions organized by purpose:

**API:**
- `apiFetch()` - Centralized API calls to `/api/v1/*`
- `getToken()` - Get auth token from cookies

**LocalStorage:**
- `loadQuickReplies()` / `saveQuickReplies()`
- `loadNotes()` / `saveNotes()`
- `loadStages()` / `saveStages()`
- `loadArchived()` / `saveArchived()`
- `loadLabels()` / `saveLabels()`

**Text Processing:**
- `normPhone()` - Normalize phone numbers
- `fmtTs()` - Format timestamps (heute, yday, date)
- `mapMessageItem()` - Map API response to Message type
- `sortMessagesChronologically()` - Sort messages by timestamp
- `extractMsgText()` - Extract text from Baileys message objects
- `parseCSV()` - Parse CSV for bulk messaging
- `applyTemplate()` - Apply {nome} placeholders

**UI:**
- `playNotifSound()` - Play notification sound
- `showBrowserNotif()` - Show browser notification
- `hasRealName()` - Check if contact has real name vs phone

### Components

Each component is **self-contained** with its own:
- Local state (if needed)
- Props interface (typed)
- Hooks (useEffect, useRef)
- Event handlers
- Styling

**ConversasTab.tsx** (Phase 1 ✅)
- 800 lines
- Handles: chat list, message view, composer, quick replies, notes
- No external dependencies (pure React)

---

## 🔄 State Management

Main states are held in `page.tsx` and passed as props:

```typescript
// Connection
const [waState, setWaState] = useState<WaState | null>(null)
const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

// Chat list
const [contacts, setContacts] = useState<Contact[]>([])
const [selectedId, setSelectedId] = useState('')

// Message view
const [messages, setMessages] = useState<Message[]>([])
const [composer, setComposer] = useState('')

// CRM
const [stages, setStages] = useState<Record<string, Stage>>({})
const [labelsByPhone, setLabelsByPhone] = useState<Record<string, ContactLabel[]>>({})
const [archivedChats, setArchivedChats] = useState<Set<string>>(new Set())

// ... more states for bulk, AI, Instagram, etc.
```

**Why not Redux/Context?**
- Single page app with few shared states
- Props drilling is acceptable at current scale
- Future refactor to Context API planned if complexity grows

---

## 🔗 Integration Points

### Backend API (`/api/v1/*`)

All requests go through `apiFetch()` which targets:

```
POST   /start              Start WhatsApp connection
GET    /status             Get connection status
GET    /events (SSE)       Real-time event stream
GET    /chats              List all chats
GET    /messages           Get chat messages
POST   /send               Send message
GET    /contacts           Get CRM contacts
POST   /crm/:chatId        Save CRM data
GET    /groups             Get WhatsApp groups
POST   /bulk-send          Start bulk messaging
POST   /ai-control         Update AI settings
... and more
```

See `web-admin/src/app/api/v1/[...slug]/route.ts` for proxy implementation.

### LocalStorage (Client-side only)

Used for client-side state that persists:

- `sofi_quick_replies` - Quick reply templates
- `sofi_internal_notes` - Internal notes
- `sofi_crm_stages` - Contact stages (until migrated to DB)
- `sofi_crm_archived` - Archived chats
- `sofi_crm_labels` - Contact labels

**TODO:** Migrate all of this to PostgreSQL/Prisma (currently in whatsapp-sync.service.js on backend)

---

## 🧪 Testing

### Unit Test Template

```typescript
// components/ConversasTab.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversasTab } from './ConversasTab'

describe('ConversasTab', () => {
  it('displays contact list when contacts loaded', () => {
    const mockContact = { chatId: '123', phone: '5511999999', name: 'João', ... }
    render(<ConversasTab contacts={[mockContact]} ... />)
    expect(screen.getByText('João')).toBeInTheDocument()
  })

  it('sends message on Enter key', async () => {
    const user = userEvent.setup()
    const mockSend = jest.fn()
    render(<ConversasTab sendMessage={mockSend} ... />)
    
    const input = screen.getByPlaceholderText(/Digite uma mensagem/)
    await user.type(input, 'Hello')
    await user.keyboard('{Enter}')
    
    expect(mockSend).toHaveBeenCalled()
  })
})
```

---

## 🐛 Debugging

### Enable Debug Logging

```typescript
// In utils.ts or any component:
console.log('[WhatsApp]', 'Message sent:', { chatId, text })
```

### Browser DevTools

1. **React DevTools** - Inspect component tree
2. **Network tab** - Monitor `/api/v1/*` requests
3. **Console** - Check for errors
4. **Application > Cookies** - Verify `accessToken`
5. **Application > LocalStorage** - Check CRM data

### SSE Stream Debugging

```javascript
// In browser console:
const es = new EventSource('/api/v1/events')
es.addEventListener('message', (e) => console.log('Message:', JSON.parse(e.data)))
es.addEventListener('state', (e) => console.log('State:', JSON.parse(e.data)))
es.onerror = () => console.log('SSE Error')
```

---

## 📚 Related Files

- **Backend:** `/backend/src/modules/whatsapp/`
- **Proxy route:** `/web-admin/src/app/api/v1/[...slug]/route.ts`
- **Types used:** `web-admin/src/app/whatsapp/types.ts`
- **Audit report:** `/AUDIT_REPORT.md`

---

## 🚦 Roadmap

### Phase 1: Core Components ✅
- [x] types.ts - All interfaces
- [x] utils.ts - All helpers
- [x] ConversasTab.tsx - Chat conversations
- [x] REFACTORING_PLAN.md - Documentation

### Phase 2: Remaining Components ⏳
- [ ] KanbanTab.tsx
- [ ] EnvioEmMassaTab.tsx
- [ ] GruposTab.tsx
- [ ] SofiIATab.tsx
- [ ] AnalyticsTab.tsx
- [ ] components/index.ts - Update exports

### Phase 3: Integration 🔮
- [ ] Refactor page.tsx - Use components
- [ ] Remove old code from page.tsx
- [ ] Test all tabs

### Phase 4: Optimization 🔮
- [ ] Extract custom hooks (useSSE, useMessages)
- [ ] Add error boundaries
- [ ] Lazy load tab components
- [ ] Unit tests

### Phase 5: Database Migration 🔮
- [ ] Move localStorage → PostgreSQL
- [ ] Update backend whatsapp-sync.service.js
- [ ] Remove localStorage usage

---

## 📖 Further Reading

- **REFACTORING_PLAN.md** - Detailed implementation guide for remaining components
- **AUDIT_REPORT.md** - Why this refactoring was done
- **Backend Readme:** `/backend/src/modules/whatsapp/`

---

**Last updated:** 2026-06-06  
**Status:** Framework ready, Phase 2 starting  
**Maintainer:** Claude 🤖
