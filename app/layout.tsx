import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Hacko — ideias grandes, conexões reais',description:'Encontre hackathons, forme equipes e organize desafios com Hacko.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
