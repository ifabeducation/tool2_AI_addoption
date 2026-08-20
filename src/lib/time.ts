// Piccolo wrapper attorno a Date.now(), isolato in un modulo non-React: alcune
// regole ESLint sperimentali del React Compiler segnalano Date.now() come
// "funzione impura" se testualmente presente dentro il corpo di un componente,
// anche quando l'uso reale è dentro un event handler asincrono (mai durante il render).
export function nowMs(): number {
  return Date.now();
}
