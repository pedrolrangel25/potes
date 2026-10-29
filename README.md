# Potes

App de controle financeiro pessoal: gastos do mês, potes de curto e longo prazo, e dados de mercado atualizados automaticamente.

- **Gastos, potes e backup** ficam no navegador de cada pessoa (ninguém vê os dados de ninguém).
- **Dados de mercado** (Selic, CDI, IPCA, Focus, Tesouro Direto e ranking de CDB/LCI/LCA) são coletados por um robô no GitHub Actions, em dias úteis às 8h, e salvos em `data/mercado.json`.

## Publicar (uma vez só)

1. Crie um repositório **público** no GitHub (ex.: `potes`).
2. Envie esta pasta para ele:
   ```bash
   git init
   git add .
   git commit -m "Primeira versão"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/potes.git
   git push -u origin main
   ```
3. No GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.
4. **Actions → Coletar dados de mercado → Run workflow** para a primeira coleta.
5. O link fica `https://SEU-USUARIO.github.io/potes/`. Mande para os amigos.

## Rodar o robô no seu PC (opcional)

```bash
node scripts/coletar.mjs
```

## Avisos

- Ranking de CDB/LCI/LCA vem do Investidor10 (fonte **não oficial**). Se o site mudar, o robô pode falhar; o app avisa na aba Mercado e o resto continua funcionando.
- O app mostra informação, **não recomendação**. Confirme taxas e condições na corretora.
