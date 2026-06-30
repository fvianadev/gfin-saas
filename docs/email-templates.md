# Templates de E-mail — Supabase

Cole no **Supabase Dashboard → Authentication → Email Templates**.

---

## Confirmação de Cadastro

```
<h2>Confirme seu e-mail</h2>

<p>Olá,</p>
<p>Você criou uma conta no <strong>GFin SaaS</strong>. Para ativar seu acesso, clique no botão abaixo:</p>

<p style="text-align:center">
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">
    Confirmar E-mail
  </a>
</p>

<p>Se não foi você, ignore este e-mail.</p>
<p style="color:#64748b;font-size:12px">GFin SaaS — Gestão financeira para seu negócio</p>
```

---

## Redefinição de Senha

```
<h2>Redefina sua senha</h2>

<p>Olá,</p>
<p>Recebemos uma solicitação de redefinição de senha para sua conta no <strong>GFin SaaS</strong>.</p>
<p>Clique no botão abaixo para criar uma nova senha:</p>

<p style="text-align:center">
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">
    Redefinir Senha
  </a>
</p>

<p>Se não foi você, ignore este e-mail. Sua senha permanece inalterada.</p>
<p style="color:#64748b;font-size:12px">GFin SaaS — Gestão financeira para seu negócio</p>
```

---

## Convite (Admin)

```
<h2>Você foi convidado</h2>

<p>Olá,</p>
<p>Um administrador do <strong>GFin SaaS</strong> convidou você para acessar o sistema.</p>
<p>Clique no botão abaixo para criar sua conta:</p>

<p style="text-align:center">
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">
    Aceitar Convite
  </a>
</p>

<p style="color:#64748b;font-size:12px">GFin SaaS — Gestão financeira para seu negócio</p>
```

---

## Link Mágico (Magic Link)

```
<h2>Seu link de acesso</h2>

<p>Olá,</p>
<p>Clique no botão abaixo para entrar no <strong>GFin SaaS</strong>:</p>

<p style="text-align:center">
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">
    Acessar Agora
  </a>
</p>

<p>Este link expira em 60 minutos.</p>
<p style="color:#64748b;font-size:12px">GFin SaaS — Gestão financeira para seu negócio</p>
```

---

## Alteração de E-mail

```
<h2>Confirme seu novo e-mail</h2>

<p>Olá,</p>
<p>Você solicitou a alteração do e-mail da sua conta no <strong>GFin SaaS</strong>.</p>
<p>Clique no botão abaixo para confirmar:</p>

<p style="text-align:center">
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">
    Confirmar Novo E-mail
  </a>
</p>

<p>Se não foi você, ignore este e-mail.</p>
<p style="color:#64748b;font-size:12px">GFin SaaS — Gestão financeira para seu negócio</p>
```
