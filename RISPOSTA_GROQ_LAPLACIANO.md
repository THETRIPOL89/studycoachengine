$$ \nabla^{2} f \;=\; \frac{1}{r^{2}}\,\frac{\partial}{\partial r}\!\left(r^{2}\,\frac{\partial f}{\partial r}\right) \;+\; \frac{1}{r^{2}\sin\theta}\,\frac{\partial}{\partial \theta}\!\left(\sin\theta\,\frac{\partial f}{\partial \theta}\right) \;+\; \frac{1}{r^{2}\sin^{2}\theta}\,\frac{\partial^{2} f}{\partial \phi^{2}} $$

---

## 1) Separazione della parte radiale da quella angolare

Quando scrivi il laplaciano in coordinate sferiche $(r, \theta, \phi)$, l'operatore si spezza in due blocchi che agiscono su variabili diverse:

**Parte radiale** (dipende solo da $r$):

$$ \nabla^{2}_{r} f \;=\; \frac{1}{r^{2}}\,\frac{\partial}{\partial r}\!\left(r^{2}\,\frac{\partial f}{\partial r}\right) $$

**Parte angolare** (dipende da $\theta$ e $\phi$):

$$ \nabla^{2}_{\Omega} f \;=\; \frac{1}{r^{2}\sin\theta}\,\frac{\partial}{\partial \theta}\!\left(\sin\theta\,\frac{\partial f}{\partial \theta}\right) \;+\; \frac{1}{r^{2}\sin^{2}\theta}\,\frac{\partial^{2} f}{\partial \phi^{2}} $$

La separazione è possibile perché la parte angolare contiene un fattore $1/r^{2}$ che, una volta portato fuori dall'operatore, fa sì che il laplaciano si possa riscrivere come:

$$ \nabla^{2} f \;=\; \frac{1}{r^{2}}\,\frac{\partial}{\partial r}\!\left(r^{2}\,\frac{\partial f}{\partial r}\right) \;+\; \frac{1}{r^{2}}\,\nabla^{2}_{\Omega} f $$

dove $\nabla^{2}_{\Omega}$ è il laplaciano angolare (dipende solo da $\theta$ e $\phi$). Questa struttura è il motivo per cui la separazione delle variabili $f(r,\theta,\phi) = R(r)\,Y(\theta,\phi)$ funziona: il fattore $1/r^{2}$ davanti alla parte angolare si bilancia con la struttura radiale.

---

## 2) Equazione differenziale per la funzione radiale $R(r)$

Dopo aver posto $f(r,\theta,\phi) = R(r)\,Y_{\ell}^{m}(\theta,\phi)$, dove $Y_{\ell}^{m}$ sono le armoniche sferiche che soddisfano $\nabla^{2}_{\Omega} Y_{\ell}^{m} = -\ell(\ell+1)\,Y_{\ell}^{m}$, l'equazione $\nabla^{2} f = 0$ (caso $\ell \neq 0$, ad esempio per l'atomo di idrogeno) diventa:

$$ \frac{d^{2}R}{dr^{2}} \;+\; \frac{2}{r}\,\frac{dR}{dr} \;-\; \frac{\ell(\ell+1)}{r^{2}}\,R \;=\; 0 $$

In forma compatta:

$$ \frac{1}{r^{2}}\,\frac{d}{dr}\!\left(r^{2}\,\frac{dR}{dr}\right) \;-\; \frac{\ell(\ell+1)}{r^{2}}\,R \;=\; 0 $$

Questa è un'**equazione di Eulero** (riconoscibile dai coefficienti $1/r$ e $1/r^{2}$), le cui soluzioni sono potenze di $r$:

$$ R(r) \;=\; A\,r^{\ell} \;+\; B\,r^{-(\ell+1)} $$

Quando è presente un potenziale centrale $V(r) = -1/r$ (atomo di idrogeno), l'equazione diventa un'equazione radiale di Schrödinger-like, e la soluzione è data dai **polinomi associati di Laguerre** pesati per un'esponenziale:

$$ R_{n\ell}(r) \;=\; \rho^{\ell}\,e^{-\rho/2}\,L^{2\ell+1}_{n-\ell-1}(\rho) \qquad \text{con } \rho = \frac{2r}{n\,a_{0}} $$

---

## 3) Condizioni al contorno

Le due condizioni fisiche che selezionano le soluzioni accettabili sono:

**(a) Normalizzabilità a $r \to \infty$**

La funzione d'onda deve rimanere di modulo quadrato integrabile su tutto lo spazio:

$$ \int_{0}^{\infty} |R(r)|^{2}\,r^{2}\,dr \;<\; \infty $$

Questo scarta la soluzione $r^{-(\ell+1)}$ (che diverge o non è normalizzabile per $\ell \geq 0$) e seleziona la parte a decadimento esponenziale. Per l'idrogeno, questo introduce i **numeri quantici principali** $n = 1, 2, 3, \dots$ — solo per questi valori la soluzione decade abbastanza velocemente da essere integrabile.

**(b) Regolarità all'origine $r = 0$**

La soluzione deve restare finita (o quantomeno normalizzabile) in $r = 0$:

$$ \lim_{r \to 0} R(r) \;=\; \text{finito} \qquad \text{equivalente a} \qquad \int_{0} |R(r)|^{2}\,r^{2}\,dr \;<\; \infty \text{ in un intorno di } 0 $$

Questo scarta la soluzione $r^{-(\ell+1)}$ vicino all'origine, che esplode per $\ell \geq 0$. Per le soluzioni radiali dell'idrogeno, la regolarità all'origine richiede che il polinomio di Laguerre tronchi al giusto ordine: il parametro $\ell$ deve essere un intero non negativo ($\ell = 0, 1, 2, \dots$), e con $n > \ell$.

Insieme, queste due condizioni forzano la quantizzazione: $n$ (numero quantico principale, $n = 1, 2, \dots$), $\ell$ (momento angolare, $\ell = 0, 1, \dots, n-1$), $m$ (magnetico, $m = -\ell, \dots, \ell$).

---

**Riepilogo sintetico:**

| Condizione | Dove agisce | Cosa scarta | Cosa seleziona |
|---|---|---|---|
| Normalizzabilità | $r \to \infty$ | soluzioni che divergono o decadono troppo lentamente | $n$ (numero quantico principale) |
| Regolarità | $r \to 0$ | $r^{-(\ell+1)}$ che esplode | $\ell = 0, 1, 2, \dots$ |
