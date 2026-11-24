// A small reader for the XML property lists diskutil prints with -plist.

import { decodeEntities } from "../catalog";

export type PlistValue = string | number | boolean | PlistValue[] | { [key: string]: PlistValue } | null;

export function parsePlist(xml: string): PlistValue {
  const body = xml
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const tokens = [...body.matchAll(/<(\/?)(\w+)(?:\s[^>]*?)?\s*(\/?)>|([^<]+)/g)]
    .map(m => (m[4] !== undefined ? { text: m[4] } : { close: m[1] === "/", name: m[2], empty: m[3] === "/" }))
    .filter(t => !("text" in t) || (t.text as string).trim() !== "" );
  let i = 0;

  function textUntil(name: string): string {
    let text = "";
    while (i < tokens.length) {
      const t = tokens[i++];
      if ("text" in t) text += t.text;
      else if (t.close && t.name === name) return decodeEntities(text);
    }
    throw new Error(`Unclosed <${name}> in property list`);
  }

  function value(): PlistValue {
    const t = tokens[i++];
    if (!t || "text" in t || t.close) throw new Error("Unexpected content in property list");
    switch (t.name) {
      case "plist":
        if (t.empty) return null;
        {
          const v = value();
          i++; // </plist>
          return v;
        }
      case "dict": {
        const dict: Record<string, PlistValue> = {};
        if (t.empty) return dict;
        while (i < tokens.length) {
          const k = tokens[i];
          if (!("text" in k) && k.close && k.name === "dict") { i++; return dict; }
          if ("text" in k || k.name !== "key") throw new Error("Expected <key> in property list");
          i++;
          const key = textUntil("key");
          dict[key] = value();
        }
        throw new Error("Unclosed <dict> in property list");
      }
      case "array": {
        const list: PlistValue[] = [];
        if (t.empty) return list;
        while (i < tokens.length) {
          const k = tokens[i];
          if (!("text" in k) && k.close && k.name === "array") { i++; return list; }
          list.push(value());
        }
        throw new Error("Unclosed <array> in property list");
      }
      case "true": return true;
      case "false": return false;
      case "string": return t.empty ? "" : textUntil("string");
      case "integer":
      case "real": return t.empty ? 0 : Number(textUntil(t.name).trim());
      case "date": return t.empty ? "" : textUntil("date").trim();
      case "data": return t.empty ? "" : textUntil("data").replace(/\s+/g, "");
      default: throw new Error(`Unknown <${t.name}> in property list`);
    }
  }

  return value();
}
