# Site Indico Insights (PT / EN), com página de gestão

```
index.html        ← o site
admin.html        ← GESTÃO DO SITE (interface gráfica, sem código)
conteudo.js       ← conteúdo, actualizado automaticamente pela gestão
documentos/capas/ ← capas dos relatórios (só imagens; os PDF não são publicados)
imagens/          ← criada automaticamente quando carregar fotografias
assets/           ← aspecto visual e funcionamento
```

## 1. Publicar no GitHub Pages (uma vez)
1. Crie um repositório (ex.: `indico-site`).
2. **Add file → Upload files** e arraste o conteúdo desta pasta.
3. **Settings → Pages**: Source *Deploy from a branch*, branch `main`, pasta `/ (root)`, Save.
4. Depois de 1 a 2 minutos, o site fica em `https://SEU-UTILIZADOR.github.io/indico-site/`.

## 2. Ligar a página de gestão (uma vez por pessoa)
1. Abra `…/admin.html`. Também há um link "Gestão do site" no rodapé.
2. Siga os passos em **Ligação GitHub** para criar um *token*:
   GitHub → Settings → Developer settings → Fine-grained tokens → só este repositório → *Contents: Read and write*.
3. Cole o token e o nome do repositório (ex.: `indicoinsights/indico-site`).

O token fica guardado apenas no navegador de quem o colou.
Sem token, a página de gestão abre mas não consegue publicar,
por isso é seguro o endereço `admin.html` ser público.

## 3. Gerir o conteúdo
Na página de gestão, sem escrever código:
- **Abas / Páginas:** criar, esconder, reordenar e apagar abas, e montar cada página com blocos.
  Há 14 tipos de bloco: slides, mosaico, números, serviços, projectos, documentos, contacto, entre outros.
- **Serviços** e **Projectos:** adicionar, editar, esconder e apagar.
- **Documentos:** carregue o PDF e a capa é gerada automaticamente a partir da 1ª página.
  O PDF nunca é publicado. Por defeito o site mostra "Disponível mediante pedido" e um
  botão "Pedir acesso". Para permitir o download, carregue o ficheiro no campo
  "Permitir descarregar".
- **Geral:** email, morada, clientes, filtros e países.
- **Pré-visualizar:** mostra o site com as alterações antes de as publicar.
- **Publicar:** envia as alterações. O site actualiza-se em 1 a 2 minutos.

Todos os textos têm um campo PT e um campo EN.

## Domínio próprio
**Settings → Pages → Custom domain**. No DNS do domínio, crie estes registos:

| Tipo  | Nome | Valor |
|-------|------|-------|
| A     | @    | 185.199.108.153 |
| A     | @    | 185.199.109.153 |
| A     | @    | 185.199.110.153 |
| A     | @    | 185.199.111.153 |
| CNAME | www  | SEU-UTILIZADOR.github.io |

Depois active **Enforce HTTPS**.
