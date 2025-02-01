/**
 * Represents a node in the KiCad S-expression tree
 */
export interface SExprNode {
  type: string;
  items: SExprItem[];
}

/**
 * Union type representing possible items in an S-expression node
 */
export type SExprItem = string | SExprNode;

/**
 * Parses KiCad S-expression format into an object tree
 * @param input KiCad file content
 * @returns Root S-expression node
 */
export function parseKiCadSexp(input: string): SExprNode {
  const tokens = tokenize(input);
  let index = 0;

  function parseNode(): SExprNode {
    if (tokens[index] !== '(') {
      throw new Error(`Expected '(' at token index ${index}, got '${tokens[index]}'`);
    }
    index++; // Skip '('

    const node: SExprNode = { type: tokens[index++], items: [] };

    while (index < tokens.length && tokens[index] !== ')') {
      if (tokens[index] === '(') {
        node.items.push(parseNode());
      } else {
        node.items.push(tokens[index]);
        index++;
      }
    }

    if (tokens[index] !== ')') {
      throw new Error(`Expected ')' at token index ${index}, got '${tokens[index]}'`);
    }
    index++; // Skip ')'
    return node;
  }

  return parseNode();
}

/**
 * Tokenizer for KiCad S-expressions
 * @param input Source text to tokenize
 * @returns Array of parsed tokens
 */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = input.length;

  // State tracking variables
  let inString = false;
  let tokenStart = -1;

  while (i < len) {
    const char = input[i];

    // Handle string literals
    if (inString) {
      if (char === '"' && input[i - 1] !== '\\') {
        tokens.push(input.slice(tokenStart, i + 1));
        inString = false;
        tokenStart = -1;
      }
      i++;
      continue;
    }

    // Process regular characters
    switch (char) {
      case ';':
        if (tokenStart !== -1) {
          tokens.push(input.slice(tokenStart, i));
          tokenStart = -1;
        }
        // Skip to end of line
        const nextLine = input.indexOf('\n', i);
        i = nextLine === -1 ? len : nextLine;
        break;

      case '(':
      case ')':
        if (tokenStart !== -1) {
          tokens.push(input.slice(tokenStart, i));
          tokenStart = -1;
        }
        tokens.push(char);
        i++;
        break;

      case '"':
        if (tokenStart !== -1) {
          tokens.push(input.slice(tokenStart, i));
        }
        tokenStart = i;
        inString = true;
        i++;
        break;

      case ' ':
      case '\t':
      case '\n':
      case '\r':
        if (tokenStart !== -1) {
          tokens.push(input.slice(tokenStart, i));
          tokenStart = -1;
        }
        i++;
        break;

      default:
        if (tokenStart === -1) {
          tokenStart = i;
        }
        i++;
    }
  }

  // Handle remaining token
  if (tokenStart !== -1) {
    tokens.push(input.slice(tokenStart, i));
  }

  return tokens;
}
