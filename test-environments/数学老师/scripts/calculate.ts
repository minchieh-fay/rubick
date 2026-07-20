const expression = Bun.argv[2] ?? '';
if (!/^[0-9+\-*/().\s]+$/.test(expression)) throw new Error('只允许计算基础四则运算');
const result = Function(`"use strict"; return (${expression})`)();
console.log(JSON.stringify({ expression, result }));
