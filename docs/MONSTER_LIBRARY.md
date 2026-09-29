# Monster Library / Formal Monster Database

## Monster Library

`data/monster-library.json` preserves monster ideas that have not necessarily
been formally registered in the game.

- `library_key` identifies a candidate only inside the Library.
- `library_order` preserves the source list order only. It is not a Monster ID.
- Candidate data must not be used by Story or runtime battle code.

The Monster Library is not loaded by `index.html`, the Story Engine, or the
Monster Battle Engine.

## Formal Monster Database

`data/monsters.js` is the single runtime source of truth for formally adopted
monsters. Formal Monster IDs are assigned explicitly and remain permanent.

Current formal IDs are `01` (`m001`), `02` (`m002`), and `03` (`m003`). The
formal ID `03` was explicitly assigned to Season Tree and is unrelated to its
Monster Library key or order.

Story IDs and Monster IDs are independent. Stories reference only formal
Monster IDs when a battle is intentionally connected.
