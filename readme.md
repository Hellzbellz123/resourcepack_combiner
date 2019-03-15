## Resourcepack Combiner
This program is created to help with the resourcepack conflicts problem cause by many datapacks, while it is not 100% fix it'll make things easier for you.
### Requirements
- Python 3.7.2 (only tested in this version but Python 3 should be fine in general)  
- Resourcepacks.
- Command Prompt, Terminal or any kind of command line interface.

### How to use
First you have to open up terminal and then change your directory to where the program located using this command `cd <path to the folder>` and then run `python main.py <arguments> <output name>`  
- \<arguments\> is the location of the resourcepacks can be as many as you want (separate by empty space " "), in this example I'll use `Resourcepack_1.zip` and `Resourcepack_2.zip` which is all inside folder called `input`.
- \<output name\> is the name of the folder of the combined resourcepack can be anything.  

So if we put all that together we'll get 
`python main.py "input/Resourcepack_1.zip" "input/Resourcepack_2.zip" "combined_resourcepack"`!  
as you may have notice, it is quite a pain to list everysingle resourcepacks isn't it? worry not! you can also use the folder directory in the place of \<arguments\>
so if we use that feature we'll get  
`python main.py input/ "combined_resourcepack"`
which is a lot easier and it'll read every single resourcepack within that folder and merge it all together into one pack which will be inside newly created folder called `output/<output name>` (be careful not to put anything valueble in there it might get deleted!)
## Miscellaneous
`conflict.log` : if the program ran into a conflict it'll write it down inside this file, if the conflicted file can be merge it'll say "Conflict found in: \<file name\> will try to merge conflict" BUT! this does not mean that it'll successfully merge everytime sometimes there are change that cannot be merge which you have to manually check yourself.
