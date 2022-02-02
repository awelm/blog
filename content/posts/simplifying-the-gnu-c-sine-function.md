---
title: "Unpacking the GNU C Sine Function"
date: 2021-12-18T11:09:07-08:00
draft: false
math: true
---

Have you ever wondered how computers calculate trigonometric functions like `sin` and `cos`? Back in the day people used lookup tables, but this approach doesn't scale when handling floating point inputs with higher precision. You might recall from calculus that `sin` and other differentiable functions can be expressed as an infinite sum known as the [Taylor Series](https://en.wikipedia.org/wiki/Taylor_series). I always assumed that trigonometric function implementations used Taylor Series under the hood because CPUs are only capable of basic arithmetic. So I decided to dive into the [glibc](https://www.gnu.org/software/libc/) source code to verify my theory and understanding. While reading the source code for the Taylor Series calculation, I noticed some small improvements I could make. This post discusses the [changes](https://patchwork.sourceware.org/project/glibc/patch/20211212183503.9332-1-akilawelihinda@ucla.edu/) I merged into glibc and the background knowledge required to understand them.

### Taylor Series Overview

Here is the Taylor Series expansion for the function `f(x)` around the point `b`, which can be [proved](https://math.stackexchange.com/questions/706282/how-are-the-taylor-series-derived) via integration-by-parts.

*Figure 1:*
$$
f(x) = f(b) + f'(b)\frac{(x-b)^1}{1!} + f''(b)\frac{(x-b)^2}{2!} + f'''(b)\frac{(x-b)^3}{3!}+\dotsb \newline = \sum_{k=0}^\infty f^{\left(k\right)}(b)\frac{(x-b)^k}{k!}
$$

It's important to note that the expansion's accuracy degrades as `x` diverges from the center point `b`. By using this equation, we get the following expansion for the `sin` function centered around 0.

*Figure 2:*
$$
sin(x) = x - \frac{x^3}{3!} + \frac{x^5}{5!} - \frac{x^7}{7!} + \frac{x^9}{9!} \dotsb
$$

### glibc Sine Implementation

If you jump into the [s_sin.c](https://github.com/bminor/glibc/blob/release/2.34/master/sysdeps/ieee754/dbl-64/s_sin.c#L56) file prior to my change, you'll see a comment saying the code implements the following variation of the `sin` Taylor expansion.

*Figure 3:*
$$
a - \frac{a^3}{3!} + \frac{a^5}{5!} - \frac{a^7}{7!} + \frac{a^9}{9!} + d_a\frac{(1-a^2)}{2}
$$

This is exactly what we have in Figure 2, except with the mysterious $d_a\frac{(1-a^2)}{2}$ term at the end. Because [rounding errors](https://floating-point-gui.de/errors/rounding/) are a given in floating point arithmetic, it's possible that the final result of the evaluated expansion is inaccurate due to the rounding that happens during each arithmetic operation. To combat this problem, the implementation adds this unexplained "precision recovery term" $d_a\frac{(1-a^2)}{2}$ at the end of the expansion. This term is meant to help the final result regain some precision that won't be erased by further floating point arithmetic. But where does this precision recovery term come from and what is $d_a$?

The glibc implementation reinterprets the `sin` input  `x` as $x=a+d_a$, where $d_a$ is a small number on the order of $10^{-19}$. This technique of expressing one 64-bit value as the sum of two 64-bit values in order to emulate higher precision is known as [double-double arithmetic](https://en.wikipedia.org/wiki/Quadruple-precision_floating-point_format#Double-double_arithmetic). We can derive the precision recovery term $d_a\frac{(1-a^2)}{2}$ by plugging $a+d_a$ into the formula in Figure 2. We only need to include $d_a$ in the first 2 terms of the expansion because at higher powers the effect of $d_a$ becomes negligible.

*Figure 4:*
$$
sin(a+d_a) \approx a+d_a - \frac{(a+d_a)^3}{3!} + \frac{a^5}{5!} - \frac{a^7}{7!} + \frac{a^9}{9!}
$$

After expanding via [Wolfram Alpha](https://www.wolframalpha.com/input/?i=a%2Bd+-+%28a%2Bd%29%5E3%2F3%21+%2B+a%5E5%2F5%21+-+a%5E7%2F7%21+%2B+a%5E9%2F9%21+-+%28a-+a%5E3%2F3%21+%2B+a%5E5%2F5%21+-+a%5E7%2F7%21+%2B+a%5E9%2F9%21%29) and simplifying we get the relationship below.

*Figure 5:*
$$
sin(a+d_a) \approx a - \frac{a^3}{3!} + \frac{a^5}{5!} - \frac{a^7}{7!} + \frac{a^9}{9!} + (d_a-\frac{a^2d_a}{2}-\frac{ad_a^2}{2}-\frac{d_a^3}{6})
$$

We can drop $\frac{ad_a^2}{2}$ and $\frac{d_a^3}{6}$ because they are higher powers of the tiny value $d_a$, so the precision recovery term in Figure 5 simplifies to $d_a-\frac{a^2d_a}{2}$. This is different from the precision recovery term of $d_a\frac{(1-a^2)}{2}$ that is included in the comment. If we look at the [source code](https://github.com/bminor/glibc/blob/release/2.34/master/sysdeps/ieee754/dbl-64/s_sin.c#L62) shown below, we'll see the TAYLOR_SIN macro actually uses our derived version of the precision recovery term when evaluating the intermediate value `t`. So it appears the comment isn't correct.

It's also strange how the TAYLOR_SIN macro seems to assume `a` always equals `x` because it calculates $a^3$ by multiplying `xx` (which is $x^2$) and `a`. You can identity the $a^3$ term by looking for which term has the leading coefficient `s1`, which is the pre-computed value for $-\frac{1}{3!}$. Also if you check the macro's only [callsite](https://github.com/bminor/glibc/blob/release/2.34/master/sysdeps/ieee754/dbl-64/s_sin.c#L129), you'll see that `a` is indeed equal to `x`.

```c
/* Helper macros to compute sin of the input values.  */
#define POLYNOMIAL2(xx) ((((s5 * (xx) + s4) * (xx) + s3) * (xx) + s2) * (xx))

#define POLYNOMIAL(xx) (POLYNOMIAL2 (xx) + s1)

/* The computed polynomial is a variation of the Taylor series expansion for
   sin(a):
   a - a^3/3! + a^5/5! - a^7/7! + a^9/9! + (1 - a^2) * da / 2
   The constants s1, s2, s3, etc. are pre-computed values of 1/3!, 1/5! and so
   on.  The result is returned to LHS.  */

#define TAYLOR_SIN(xx, a, da) \
({									                                          \
  double t = ((POLYNOMIAL (xx)  * (a) - 0.5 * (da))  * (xx) + (da));	      \
  double res = (a) + t;							                              \
  res;									                                      \
})
```

Now that you have seen and understand all the relevant code, here is a summary of the [2 changes](https://patchwork.sourceware.org/project/glibc/patch/20211212183503.9332-1-akilawelihinda@ucla.edu/) I merged into glibc.

1. Update the comment to include the correct precision recovery term $d_a-\frac{a^2d_a}{2}$
2. Make it clear that the TAYLOR_SIN macro actually expects `x` as the second parameter by renaming `a` → `x` (and similarly `da` → `dx`). Also update the formula in the macro's documentation to reflect this.

Neither of these changes actually introduce a behavior change in the library, so you could argue that my contribution was pointless. But hopefully you learned something by reading this post and find the glibc source code a litte more approachable.


### Closing Thoughts

After trying to wrap my head around the glibc math library, I have a lot of newfound respect for its creators and maintainers. I wasn't aware that so many advanced numerical computing [techniques](https://hal-ens-lyon.archives-ouvertes.fr/ensl-01529804/document) were needed to accurately compute basic math functions. I'm still surprised that curiosity eventually led me to make a slight improvement to a widely-used core systems library. Working on this was a lot of fun because it required uniting concepts from calculus and computer architecture. I hope to make more open source contributions in the future.