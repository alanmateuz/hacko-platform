import type { Metadata } from "next";
import Landing from "./landing";
import "./landing.css";

export const metadata: Metadata = {
  title: "Hacko — o seu próximo desafio é aqui",
  description: "Encontre hackathons, monte sua equipe e tire suas ideias do papel. Para empresas: organize hackathons do início à entrega.",
};

export default function Sobre() {
  return <Landing />;
}
