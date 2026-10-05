export function csvCell(v:unknown):string{let t=String(v??'');if(/^[=+\-@]/.test(t))t="'"+t;return `"${t.replaceAll('"','""')}"`}
