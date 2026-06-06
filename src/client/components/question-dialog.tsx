import { type FormEvent, useEffect, useRef, useState } from "react";

import type { QuestionDraft, QuestionType } from "../types/room";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

interface OptionInput {
  id: number;
  value: string;
}

interface QuestionDialogProps {
  isOpen: boolean;
  onAdd: (question: QuestionDraft) => void;
  onClose: () => void;
}

export function QuestionDialog({ isOpen, onAdd, onClose }: QuestionDialogProps) {
  const [title, setTitle] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("single");
  const [options, setOptions] = useState<OptionInput[]>(createInitialOptions);
  const [error, setError] = useState("");
  const nextOptionId = useRef(3);
  const titleInput = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    titleInput.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) {
      return;
    }

    setOptions((current) => [...current, { id: nextOptionId.current++, value: "" }]);
  };

  const removeOption = (id: number) => {
    if (options.length <= MIN_OPTIONS) {
      return;
    }

    setOptions((current) => current.filter((option) => option.id !== id));
  };

  const updateOption = (id: number, value: string) => {
    setOptions((current) =>
      current.map((option) => (option.id === id ? { ...option, value } : option)),
    );
  };

  const resetForm = () => {
    setTitle("");
    setQuestionType("single");
    setOptions(createInitialOptions());
    setError("");
    nextOptionId.current = 3;
  };

  const closeDialog = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("質問を入力してください。");
      return;
    }

    if (options.some((option) => !option.value.trim())) {
      setError("すべての選択肢を入力してください。");
      return;
    }

    onAdd({
      title: title.trim(),
      questionType,
      options: options.map((option) => option.value.trim()),
    });
    resetForm();
  };

  return (
    <div
      aria-labelledby="question-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-slate-200 bg-white px-6 py-5 sm:px-8">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-sky-700">NEW QUESTION</p>
            <h2
              className="mt-2 text-2xl font-bold tracking-tight text-slate-950"
              id="question-dialog-title"
            >
              質問を追加
            </h2>
          </div>
          <button
            aria-label="閉じる"
            className="flex size-10 items-center justify-center rounded-xl border border-slate-200 text-xl text-slate-500 transition hover:bg-slate-100"
            onClick={closeDialog}
            type="button"
          >
            ×
          </button>
        </div>

        <form className="p-6 sm:p-8" noValidate onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-bold text-slate-800" htmlFor="new-question-title">
              質問
            </label>
            <textarea
              className={`${inputClassName} mt-2 min-h-28 resize-y`}
              id="new-question-title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="参加者に聞きたいこと"
              ref={titleInput}
              required
              value={title}
            />
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-bold text-slate-800">投票形式</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TypeOption
                checked={questionType === "single"}
                description="ひとつだけ選んで回答"
                label="単一選択"
                onChange={() => setQuestionType("single")}
                value="single"
              />
              <TypeOption
                checked={questionType === "multiple"}
                description="複数の項目を選んで回答"
                label="複数選択"
                onChange={() => setQuestionType("multiple")}
                value="multiple"
              />
            </div>
          </fieldset>

          <div className="mt-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">選択肢</h3>
                <p className="mt-1 text-xs text-slate-500">2〜10件まで設定できます。</p>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {options.length} / {MAX_OPTIONS}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {options.map((option, index) => (
                <div
                  className="grid grid-cols-[2rem_minmax(0,1fr)_2.75rem] items-center gap-3"
                  key={option.id}
                >
                  <span className="text-center text-sm font-bold text-slate-400">{index + 1}</span>
                  <input
                    aria-label={`新しい選択肢${index + 1}`}
                    className={inputClassName}
                    onChange={(event) => updateOption(option.id, event.target.value)}
                    placeholder={`選択肢${index + 1}`}
                    required
                    type="text"
                    value={option.value}
                  />
                  <button
                    aria-label={`新しい選択肢${index + 1}を削除`}
                    className="flex size-11 items-center justify-center rounded-xl border border-slate-200 text-lg text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35"
                    disabled={options.length <= MIN_OPTIONS}
                    onClick={() => removeOption(option.id)}
                    type="button"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button
              className="mt-4 rounded-xl border border-dashed border-sky-300 px-4 py-2.5 text-sm font-bold text-sky-700 transition hover:border-sky-500 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={options.length >= MAX_OPTIONS}
              onClick={addOption}
              type="button"
            >
              <span aria-hidden="true">＋ </span>
              選択肢を追加
            </button>
          </div>

          {error ? (
            <p
              className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
            <button
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              onClick={closeDialog}
              type="button"
            >
              キャンセル
            </button>
            <button
              className="rounded-xl bg-sky-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-700"
              type="submit"
            >
              下書きとして追加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-100";

function createInitialOptions(): OptionInput[] {
  return [
    { id: 1, value: "" },
    { id: 2, value: "" },
  ];
}

function TypeOption({
  checked,
  description,
  label,
  onChange,
  value,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: () => void;
  value: QuestionType;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
        checked
          ? "border-sky-500 bg-sky-50 ring-2 ring-sky-100"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <input
        checked={checked}
        className="mt-1 size-4 accent-sky-600"
        name="newQuestionType"
        onChange={onChange}
        type="radio"
        value={value}
      />
      <span>
        <span className="block text-sm font-bold text-slate-800">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
    </label>
  );
}
