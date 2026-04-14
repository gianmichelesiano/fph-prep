# Admin Catalog Page — Design Spec

## Overview

Una pagina admin `/admin/catalog` per gestire aree e notebook. Aggiunge un link "Catalog" nella sidebar admin. Permette CRUD sui notebook e associazione notebook → area.

## Sidebar

Aggiungere voce al NAV array in `AdminLayout.jsx`:
```js
{ to: '/admin/catalog', label: 'Catalog', icon: 'category' }
```
Posizione: tra "Simulations" e "AI Generate".

## Pagina `/admin/catalog`

File: `src/pages/admin/Catalog.jsx`

Due tab: **Areas** | **Notebooks**

### Tab Areas

- Lista statica delle 10 aree (id 1-10)
- Colonne: ID, Nome, Colore (badge visivo), Domande collegate (count)
- Inline edit del campo `name` — salva su `public.areas` via update
- No add/delete (le aree sono fisse)

### Tab Notebooks

- Lista di tutti i notebook da `public.notebooks`
- Colonne: Key, Titolo, Area (badge colorato), Argomento (troncato)
- **Associa area:** select dropdown inline su ogni riga → salva `area_id` su `public.notebooks`
- **Add:** form in fondo alla lista — campi: UUID, key, titolo, area, argomento → insert
- **Edit:** click sulla riga apre editing inline di titolo e argomento
- **Delete:** icona cestino → conferma → delete (solo se `notebook_id` non è referenziato in `questions`)

## API (`src/lib/adminApi.js`)

Aggiungere le seguenti funzioni:

```js
fetchAreas()              // select * from areas order by id
updateArea(id, { name })  // update areas set name=... where id=...

fetchNotebooks()                          // select *, areas(*) from notebooks order by area_id, key
createNotebook(data)                      // insert into notebooks
updateNotebook(id, data)                  // update notebooks set ... where id=...
deleteNotebook(id)                        // delete from notebooks where id=...
```

## Route

Aggiungere in `App.jsx` (o file routing):
```jsx
<Route path="/admin/catalog" element={<Catalog />} />
```

## Vincoli

- Usa `supabaseAdmin` per tutte le operazioni (bypass RLS)
- Segue pattern esistente: stesso stile di `Questions.jsx` e `Simulations.jsx`
- Badge colore area riutilizza `AREAS` color_class da `areas.js` (finché non si legge da DB)
- Delete notebook disabilitato se ha domande collegate (check `questions.notebook_id`)
