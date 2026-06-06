import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 複数のクラス名を結合し、Tailwind CSSのクラス競合を解決します
 *
 * clsxで条件付きクラス名を結合し、twMergeでTailwindのクラスを
 * 適切にマージします（例: 同じプロパティの後勝ち）。
 *
 * @param inputs - 結合するクラス名（文字列、配列、オブジェクト）
 * @returns マージされたクラス名文字列
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
