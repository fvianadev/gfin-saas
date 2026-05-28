export interface UserSession {
  id: string
  membro_id: string | null
  nome: string
  estabelecimento_id: string
  estabelecimento_slug?: string
  role: 'administrador' | 'usuario' | 'super_admin'
}
