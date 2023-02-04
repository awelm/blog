---
title: "Exploring SIMD performance improvements in WebAssembly"
date: 2021-11-10T13:14:33-05:00
draft: false
---

In this blog post, we are going to run some [SIMD](http://ftp.cvut.cz/kernel/people/geoff/cell/ps3-linux-docs/CellProgrammingTutorial/BasicsOfSIMDProgramming.html) (Single Instruction Multiple Data) performance experiments in [WebAssembly](https://webassembly.org/) and see whether the results agree with our theoretical predictions. I chose to do this in WebAssembly because it's an exciting technology that I wanted to learn more about.

### What is SIMD

SIMD is a technique for running a single CPU instruction on multiple data operands in parallel. This is done by packing multiple data operands into a special, wide CPU register and then using a dedicated SIMD instruction to operate on all the packed operands at once. SIMD is used to speed up repetitive computations that can be done in parallel, which frequently show up graphics or data processing. When I was working at Databricks, my sister team [rewrote](https://databricks.com/blog/2021/06/17/announcing-photon-public-preview-the-next-generation-query-engine-on-the-databricks-lakehouse-platform.html) the Apache Spark engine to utilize SIMD instructions (referred to as a "native vectorized engine"). This rewrite along with other shipped projects allowed the company to [double](https://databricks.com/blog/2021/11/02/databricks-sets-official-data-warehousing-performance-record.html) the previous TPC-DS world record for data warehouse performance! I mention this to hopefully convince you that SIMD is important and can actually make a real world impact.


### Sample Problem

Let's imagine that we want to create an image that only contains white pixels. The hex [RBG value](https://www.rapidtables.com/web/color/white-color.html) for a white pixel is 0xFFFFFF, so that means an all-white image is just a piece of memory with all bits set to 1. We can set all bits to 1 by iterating through all bytes and setting each byte to 0xFF. Normally the CPU's [word size](https://en.wikipedia.org/wiki/Word_(computer_architecture)), typically 32 or 64 bits, determines how many bits we can set with one CPU instruction. However, on CPUs with SIMD support we can set 128 bits or more at once. Let's compare the performance of creating our image 32 bits at a time vs 128 bits at a time via SIMD. Intuitively we expect the 128-bit creation to be 4 times faster.


### Creating the Image

Below is the WebAssembly I've written to create our all-white image using SIMD instructions. Here's a rundown of what the code does:

1. Allocates a 64MB portion of memory. Usually images are much smaller, but using a larger size will give us more accurate measurements

2. The program takes an integer input named `numIterations`. This determines how many times we perform the image creation. Multiple iterations are necessary to get an accurate performance measurement because there are random deviations in program execution time, depending on the other workloads the CPU is juggling during runtime.

3. During each iteration, set all the bits in the allocated memory buffer to 1

```asm
(module
  ;; Allocate a memory buffer of 1000 64KB pages (64MB total) for our image
  (memory (export "memory") 1000 1000)
  (func $fillBufferWithSIMD (param $numIterations i32)
    ;; declare local variables
    (local $currentIteration i32)
    (local $bufferPtr i32)
    (local $bufferSizeBytes i32)

    ;; Set currentIteration=0 and bufferSizeBytes=64MB
    (local.set $currentIteration (i32.const 0))
    (local.set $bufferSizeBytes (i32.const 64000000))

    ;; For each iteration we will fill the entire memory buffer with 1 bits 
    (block $breakAllIterations
      (loop $allIterationsTop
        ;; Loop while currentIteration < numIterations 
        (br_if $breakAllIterations (i32.eq (local.get $numIterations) (local.get $currentIteration)))

        ;; Set bufferPtr=0 so we start the current iteration at the beginning of the buffer
        (local.set $bufferPtr (i32.const 0))

        (block $breakCurrentIteration
          (loop $currentIterationTop
            ;; Loop while bufferPtr is less than bufferSizeBytes
            (br_if $breakCurrentIteration (i32.eq (local.get $bufferSizeBytes) (local.get $bufferPtr)))
            ;; Set the current 128-bit region (pointed to by bufferPtr) to contain all 1's
            (v128.store (local.get $bufferPtr) (v128.const i32x4 0xFFFFFFFF 0xFFFFFFFF 0xFFFFFFFF 0xFFFFFFFF)) 
            ;; Advance the bufferPtr by 128 bits (aka 16 bytes)
            (local.set $bufferPtr (i32.add (local.get $bufferPtr) (i32.const 16)))
            (br $currentIterationTop)
          )
        )

        ;; Increment currentIteration by 1
        (local.set $currentIteration (i32.add (local.get $currentIteration) (i32.const 1))) 
        (br $allIterationsTop) 
      ) 
    )
  )
  (export "fillBufferWithSIMD" (func $fillBufferWithSIMD))
)
```

We can compile and run this WebAssembly program using the command below. Notice that we specify the `numIteration=10000` at the end.

```bash
wat2wasm --enable-simd fillBufferWithSIMD.wat && wasmer fillBufferWithSIMD.wasm -i fillBufferWithSIMD 10000
```

[Here](https://github.com/awelm/simd-wasm-profiling/blob/master/fillBufferWithoutSIMD.wat) is the WebAssembly code for creating our image 32 bits at a time without using SIMD. It's very similar, except we use CPU instructions with 32-bit operands and we advance the buffer pointer by 32 bits.



### Performance Comparison

Here is a table summarizing the image creation performance as we increase the number of iterations.

| numIterations | 128-bit SIMD Time (sec) | 32-bit Time (sec) | Speedup Ratio |
| :------------- | :----------------------- | :----------------- | :----- |
| 1 | 0.052 | 0.069 | 1.33 |
| 10 | 0.065 | 0.142 | 2.18 |
| 100 | 0.297 | 1.055 | 3.55 |
| 1,000 | 2.592 | 10.188 | 3.93 |
| 10,000 | 25.478 | 100.89 | 3.96 |

These results should look intuitive. When we perform less iterations, the constant time to required allocate the 64MB memory buffer tends to dominate the execution time. As we increase the number of iterations, we see the SIMD performance boost gradually converges to 4x as per our initial prediction.