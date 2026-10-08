import { fireEvent, render, screen } from "@testing-library/react";
import { Board } from "./Board.tsx";

test("adiciona um cartão e edita o título inline", () => {
  render(<Board />);

  // abre o formulário da primeira coluna ("A Fazer") e cria um cartão
  fireEvent.click(screen.getAllByRole("button", { name: "+ Adicionar cartão" })[0]!);
  fireEvent.change(screen.getByLabelText("Título do novo cartão"), { target: { value: "Estudar useEffect" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
  expect(screen.getByRole("button", { name: "Estudar useEffect" })).toBeInTheDocument();

  // clica no título → vira input com foco → Enter salva
  fireEvent.click(screen.getByRole("button", { name: "Estudar useEffect" }));
  const input = screen.getByLabelText("Título do cartão");
  expect(input).toHaveFocus();
  fireEvent.change(input, { target: { value: "Estudar useEffect e useRef" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(screen.getByRole("button", { name: "Estudar useEffect e useRef" })).toBeInTheDocument();

  // Esc cancela sem salvar
  fireEvent.click(screen.getByRole("button", { name: "Estudar useEffect e useRef" }));
  fireEvent.change(screen.getByLabelText("Título do cartão"), { target: { value: "descartado" } });
  fireEvent.keyDown(screen.getByLabelText("Título do cartão"), { key: "Escape" });
  expect(screen.queryByText("descartado")).not.toBeInTheDocument();
});
