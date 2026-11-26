import {
  BotIcon,
  ListTodoIcon,
  CalendarCheckIcon,
  MailIcon,
  MessageCircleIcon,
  MicIcon,
  PhoneIcon,
  StickyNoteIcon,
  UsersIcon,
} from 'lucide-react'
import type { TipoAtividade } from '@/types'

// Fora do módulo 'use client' para servir também aos componentes de servidor.
export const ICONE_ATIVIDADE: Record<TipoAtividade, typeof StickyNoteIcon> = {
  nota: StickyNoteIcon,
  ligacao: PhoneIcon,
  whatsapp: MessageCircleIcon,
  visita: CalendarCheckIcon,
  reuniao: UsersIcon,
  email: MailIcon,
  audio: MicIcon,
  tarefa: ListTodoIcon,
  sistema: BotIcon,
}
